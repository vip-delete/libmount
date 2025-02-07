import {
  DIR_CRT_DATE_TIME_OFFSET,
  DIR_ENTRY_ATTR_DIRECTORY,
  DIR_ENTRY_ATTR_LFN,
  DIR_ENTRY_ATTR_VOLUME_ID,
  DIR_ENTRY_FLAG_DELETED,
  DIR_ENTRY_FLAG_LAST,
  DIR_ENTRY_SIZE,
  DIR_ENTRY_SIZE_BITS,
  DIR_FILE_SIZE_OFFSET,
  DIR_FST_CLUS_HI_OFFSET,
  DIR_FST_CLUS_LO_OFFSET,
  DIR_LST_ACC_DATE_OFFSET,
  DIR_NAME_LENGTH,
  DIR_WRT_DATE_TIME_OFFSET,
  FAT_THRESHOLD,
  FREE_CLUS,
  FSI_NEXT_FREE_OFFSET,
  LFN_MAX_LEN,
  LFN_NAME1_LENGTH,
  LFN_NAME2_LENGTH,
  LFN_NAME3_LENGTH,
  MIN_CLUS_NUM,
} from "./const.mjs";
import {
  createDirEntry,
  createDotDirEntry,
  createVolumeDirEntry,
  isBpbFat32,
  isDirEntryLFN,
  loadBootSector,
  loadDirEntry,
  loadDirEntryLFN,
  loadFSI,
  writeDirEntry,
  writeDirEntryLFN,
} from "./dao.mjs";
import { createLogger } from "./log.mjs";
import { BootSector, DirEntry, DirEntryLFN, FAT, FATNode, FATVariables, IO, Logger } from "./types.mjs";
import {
  assert,
  getChkSum,
  impossibleNull,
  isShortNameValidCode,
  lfnToStr,
  normalizeLongName,
  parseDate,
  parseDateTime,
  sfnToStr,
  split,
  str2bytes,
  strToLfn,
  strToSfn,
  strToTildeName,
  strToUint8Array,
  toDate,
  toTime,
  toTimeTenth,
} from "./utils.mjs";

/**
 * @type {!Logger}
 */
const log = createLogger("FS");

// @ts-expect-error
// eslint-disable-next-line no-undef
const /** @type {boolean} */ LFN_ENABLED = typeof USE_LFN === "boolean" ? USE_LFN : true;

const NODE_ROOT = 0;
const NODE_LABEL = 1;
const NODE_DOT_DIR = 2;
const NODE_REG_DIR = 3;
const NODE_REG_FILE = 4;
const NODE_DELETED = 5;
const NODE_LAST = 6;

const DIR_LN_LAST_LONG_ENTRY = 0x40;

/**
 * @param {number} kind
 * @param {string} shortName
 * @param {number} offset
 * @param {!DirEntry} dirEntry
 * @return {!FATNode}
 */
const createNode = (kind, shortName, offset, dirEntry) => {
  const isRoot = kind === NODE_ROOT;
  const isRegDir = kind === NODE_REG_DIR;
  const isRegFile = kind === NODE_REG_FILE;
  return {
    shortName,
    dirOffset: offset,
    dirEntry,
    fstClus: (dirEntry.FstClusHI << 16) | dirEntry.FstClusLO,
    isRoot,
    isLabel: kind === NODE_LABEL,
    isRegDir,
    isRegFile,
    isDir: isRoot || isRegDir,
    isReg: isRegDir || isRegFile,
    isDeleted: kind === NODE_DELETED,
    isLast: kind === NODE_LAST,
    // LFN extension
    longName: shortName,
    firstDirOffset: offset,
    dirCount: 1,
  };
};

const DUMMY_DIR = createDirEntry(new Uint8Array(DIR_NAME_LENGTH), null);
const ROOT_NODE = createNode(NODE_ROOT, "", 0, DUMMY_DIR);

/**
 * @type {!Uint8Array}
 */
const DOT_SFN = str2bytes(".          ");

/**
 * @type {!Uint8Array}
 */
const DOT_DOT_SFN = str2bytes("..         ");

/**
 * @private
 * @param {!BootSector} bs
 * @return {!FATVariables}
 */
const loadFATVariables = (bs) => {
  const bpb = bs.bpb;
  const bpbFat32 = isBpbFat32(bpb);
  const { BytsPerSec, SecPerClus, RsvdSecCnt, NumFATs, RootEntCnt, TotSec16, FATSz16, TotSec32, FATSz32, RootClus } = bpb;
  const RootDirSectors = bpbFat32 ? 0 : Math.ceil((RootEntCnt << DIR_ENTRY_SIZE_BITS) / BytsPerSec);
  const FATSz = bpbFat32 ? FATSz32 : FATSz16;
  const TotSec = TotSec16 ? TotSec16 : TotSec32;
  const MetaSec = RsvdSecCnt + FATSz * NumFATs + RootDirSectors;
  const DataSec = TotSec - MetaSec;
  const SizeOfCluster = BytsPerSec * SecPerClus;
  const CountOfClusters = Math.floor(DataSec / SecPerClus);
  // Windows: #define FatIndexBitSize(B) ((UCHAR)(IsBpbFat32(B) ? 32 : (FatNumberOfClusters(B) < 4087 ? 12 : 16)))
  // eslint-disable-next-line no-nested-ternary
  const IndexBits = bpbFat32 ? 32 : CountOfClusters < FAT_THRESHOLD ? 12 : 16;
  const MaxClus = CountOfClusters + 1;
  const SystemArea = RsvdSecCnt + FATSz * NumFATs;
  const RootDirSec = SystemArea + (bpbFat32 ? (RootClus - MIN_CLUS_NUM) * SecPerClus : 0);
  const FirstDataSec = SystemArea + RootDirSectors;
  const RootDirOffset = BytsPerSec * RootDirSec;
  const FinalClus = (1 << Math.min(28, IndexBits)) - 1;

  return {
    FATSz,
    TotSec,
    DataSec,
    SizeOfCluster,
    CountOfClusters,
    IndexBits,
    MaxClus,
    FirstDataSec,
    RootDirOffset,
    FinalClus,
  };
};

/**
 * @private
 * @param {string} name
 * @param {!FATNode} node
 * @return {boolean}
 */
const match = (name, node) => {
  const upper = name.toUpperCase();
  return upper === node.shortName || (LFN_ENABLED && upper === node.longName.toUpperCase());
};

/**
 *
 * @param {!FATNode} node
 * @param {!Array<!DirEntryLFN>} chain
 * @param {number} firstDirOffset
 */
const fillNode = (node, chain, firstDirOffset) => {
  if (LFN_ENABLED && chain.length) {
    // decode LFN
    const ord = chain[chain.length - 1].Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
    if (ord === 1) {
      const chksum = getChkSum(node.dirEntry.Name);
      if (chain.every((it) => it.Chksum === chksum)) {
        node.longName = lfnToStr(chain);
        node.firstDirOffset = firstDirOffset;
        node.dirCount = chain.length + 1;
      } else {
        log.warn(`Skip invalid chainLFN at ${firstDirOffset}: chksum mismatch`);
      }
    } else {
      log.warn(`Skip invalid chainLFN at ${firstDirOffset}: chain is not finished`);
    }
  }
};

/**
 * @implements {FAT}
 */
class FAT12 {
  /**
   * @param {!FileSystem} fs
   */
  constructor(fs) {
    /** @constant */ this.fs = fs;
  }

  /**
   * @override
   * @param {number} clusNum
   * @return {number}
   */
  // @ts-expect-error
  getNextClusNum(clusNum) {
    const fs = this.fs;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= fs.vars.MaxClus);
    const val = fs.io.seek(fs.offsetFATs[0] + clusNum + (clusNum >> 1)).readWord();
    return clusNum & 1 ? val >> 4 : val & fs.vars.FinalClus;
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  // @ts-expect-error
  setNextClusNum(clusNum, value) {
    const fs = this.fs;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= fs.vars.MaxClus);
    for (let i = 0; i < fs.offsetFATs.length; i++) {
      const val = fs.io.seek(fs.offsetFATs[i] + clusNum + (clusNum >> 1)).readWord();
      fs.io.skip(-2).writeWord(clusNum & 1 ? (value << 4) | (val & 0xf) : (val & 0xf000) | value);
    }
  }

  /**
   * @override
   * @return  {number}
   */
  // @ts-expect-error
  // eslint-disable-next-line class-methods-use-this
  getNextFreeClus() {
    return MIN_CLUS_NUM;
  }

  /**
   * @override
   * @param {number} clusNum
   */
  // @ts-expect-error
  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  setNextFreeClus(clusNum) {
    // no-op
  }
}

/**
 * @implements {FAT}
 */
class FAT16 {
  /**
   * @param {!FileSystem} fs
   */
  constructor(fs) {
    /** @constant */ this.fs = fs;
  }

  /**
   * @override
   * @param {number} clusNum
   * @return {number}
   */
  // @ts-expect-error
  getNextClusNum(clusNum) {
    const fs = this.fs;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= fs.vars.MaxClus);
    return fs.io.seek(fs.offsetFATs[0] + clusNum * 2).readWord();
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  // @ts-expect-error
  setNextClusNum(clusNum, value) {
    const fs = this.fs;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= fs.vars.MaxClus);
    for (let i = 0; i < fs.offsetFATs.length; i++) {
      fs.io.seek(fs.offsetFATs[i] + clusNum * 2).writeWord(value);
    }
  }

  /**
   * @override
   * @return  {number}
   */
  // @ts-expect-error
  // eslint-disable-next-line class-methods-use-this
  getNextFreeClus() {
    return MIN_CLUS_NUM;
  }

  /**
   * @override
   * @param {number} clusNum
   */
  // @ts-expect-error
  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  setNextFreeClus(clusNum) {
    // no-op
  }
}

/**
 * @implements {FAT}
 */
class FAT32 {
  /**
   * @param {!FileSystem} fs
   */
  constructor(fs) {
    /** @constant */ this.fs = fs;
    this.fsiOffset = this.fs.bs.bpb.BytsPerSec * this.fs.bs.bpb.FSInfo;
    this.fsiNxtFreeOffset = this.fsiOffset + FSI_NEXT_FREE_OFFSET;
    this.fs.io.seek(this.fsiOffset);
    loadFSI(this.fs.io);
  }

  /**
   * @override
   * @param {number} clusNum
   * @return {number}
   */
  // @ts-expect-error
  getNextClusNum(clusNum) {
    const fs = this.fs;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= fs.vars.MaxClus);
    return fs.io.seek(fs.offsetFATs[0] + clusNum * 4).readDoubleWord() & fs.vars.FinalClus;
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  // @ts-expect-error
  setNextClusNum(clusNum, value) {
    const fs = this.fs;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= fs.vars.MaxClus);
    for (let i = 0; i < fs.offsetFATs.length; i++) {
      const val = fs.io.seek(fs.offsetFATs[i] + clusNum * 4).readDoubleWord();
      fs.io.skip(-4).writeDoubleWord((val & 0xf0000000) | value);
    }
  }

  /**
   * @override
   * @return  {number}
   */
  // @ts-expect-error
  getNextFreeClus() {
    const fs = this.fs;
    const clusNum = fs.io.seek(this.fsiNxtFreeOffset).readDoubleWord();
    return clusNum >= MIN_CLUS_NUM && clusNum <= fs.vars.MaxClus ? clusNum : MIN_CLUS_NUM;
  }

  /**
   * @override
   * @param {number} clusNum
   */
  // @ts-expect-error
  setNextFreeClus(clusNum) {
    const fs = this.fs;
    fs.io.seek(this.fsiNxtFreeOffset).writeDoubleWord(clusNum);
  }
}

/**
 * @private
 * @implements {ns.FileIO}
 */
class FileIO {
  /**
   * @param {!FileSystem} fs
   * @param {!FATNode} node
   */
  constructor(fs, node) {
    /** @constant */ this.fs = fs;
    /** @constant */ this.sizeOfCluster = fs.vars.SizeOfCluster;
    /** @constant */ this.node = node;
    this.prev = 0;
    this.curr = node.fstClus;
    this.pos = 0;
    this.fileSize = 0;
  }

  /**
   * @override
   */
  // @ts-expect-error
  rewind() {
    this.prev = 0;
    this.curr = this.node.fstClus;
    this.pos = 0;
    this.fileSize = 0;
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  skipClus() {
    const { fs, sizeOfCluster, node } = this;
    let len = Math.min(sizeOfCluster, Math.max(0, node.dirEntry.FileSize - this.pos));
    if (len) {
      if (this.curr >= MIN_CLUS_NUM && this.curr <= fs.vars.MaxClus) {
        // move to the next cluster
        this.prev = this.curr;
        this.curr = fs.FAT.getNextClusNum(this.curr);
        this.pos += sizeOfCluster;
      } else {
        // unexpected EOF: file is corrupted?
        len = 0;
      }
    }
    return len;
  }

  /**
   * @override
   * @param {!Uint8Array} buf
   * @return {number}
   */
  // @ts-expect-error
  readClus(buf) {
    const { fs, sizeOfCluster, node } = this;
    let len = Math.min(sizeOfCluster, Math.max(0, node.dirEntry.FileSize - this.pos));
    if (len) {
      const offset = fs.getContentOffset(this.curr);
      if (offset) {
        buf.set(fs.io.seek(offset).peekUint8Array(len));
        // move to the next cluster
        this.prev = this.curr;
        this.curr = fs.FAT.getNextClusNum(this.curr);
        this.pos += sizeOfCluster;
      } else {
        // unexpected EOF: file is corrupted?
        len = 0;
      }
    }
    return len;
  }

  /**
   * @override
   * @param {!Uint8Array} buf
   * @return {number}
   */
  // @ts-expect-error
  writeClus(buf) {
    assert(buf.length > 0);
    const { fs, sizeOfCluster, node } = this;
    const len = Math.min(sizeOfCluster, buf.length);
    let offset = fs.getContentOffset(this.curr);
    if (!offset) {
      // EOF: need to allocated a new cluster
      const newClusNum = fs.allocateCluster();
      if (!newClusNum) {
        // no space left;
        return 0;
      }
      if (node.fstClus) {
        // assert(fs.getNextClusNum(this.prev) === this.curr);
        fs.FAT.setNextClusNum(this.prev, newClusNum);
      } else {
        this.setFirstClus(newClusNum);
      }
      this.curr = newClusNum;
      offset = fs.getContentOffset(newClusNum);
      node.dirEntry.FileSize = this.pos + len;
      fs.io.seek(node.dirOffset + DIR_FILE_SIZE_OFFSET).writeDoubleWord(node.dirEntry.FileSize);
    }
    fs.io.seek(offset).writeUint8Array(buf.subarray(0, len));
    this.fileSize = this.pos + len;

    // move to the next cluster
    this.prev = this.curr;
    this.curr = fs.FAT.getNextClusNum(this.curr);
    this.pos += sizeOfCluster;
    return len;
  }

  /**
   * @override
   * @return {!Uint8Array}
   */
  // @ts-expect-error
  readData() {
    this.rewind();
    const fileSize = this.node.dirEntry.FileSize;
    const data = new Uint8Array(fileSize);
    if (fileSize) {
      // eslint-disable-next-line init-declarations
      let len;
      let tmp = data;
      while ((len = this.readClus(tmp))) {
        tmp = tmp.subarray(len);
      }
    }
    return data;
  }

  /**
   * @override
   * @param {!Uint8Array} data
   * @return {number}
   */
  // @ts-expect-error
  writeData(data) {
    this.rewind();
    // eslint-disable-next-line init-declarations
    let len;
    let tmp = data;
    while (tmp.length && (len = this.writeClus(tmp))) {
      tmp = tmp.subarray(len);
    }

    // unlink the rest of clusters
    this.fs.unlink(this.curr);
    if (this.node.fstClus === this.curr) {
      this.setFirstClus(0);
      assert(this.pos === 0);
      assert(this.fileSize === 0);
    }
    this.node.dirEntry.FileSize = this.fileSize;
    this.fs.io.seek(this.node.dirOffset + DIR_FILE_SIZE_OFFSET).writeDoubleWord(this.node.dirEntry.FileSize);

    const fileSize = data.length - tmp.length;
    assert(fileSize === this.node.dirEntry.FileSize);
    return fileSize;
  }

  // Private

  /**
   * @private
   * @param {number} clusNum
   */
  setFirstClus(clusNum) {
    const { dirOffset, dirEntry } = this.node;
    this.node.fstClus = clusNum;
    this.fs.io
      .seek(dirOffset + DIR_FST_CLUS_HI_OFFSET)
      .writeWord((dirEntry.FstClusHI = clusNum >>> 16))
      .seek(dirOffset + DIR_FST_CLUS_LO_OFFSET)
      .writeWord((dirEntry.FstClusLO = clusNum & 0xffff));
  }
}

/**
 * @implements {ns.File}
 */
class File {
  /**
   * @param {!FileSystem} fs
   * @param {string} absolutePath
   * @param {!FATNode} node
   */
  constructor(fs, absolutePath, node) {
    /** @constant */ this.fs = fs;
    /** @constant */ this.absolutePath = absolutePath;
    /** @constant */ this.node = node;
  }

  // ns.File

  /**
   * @override
   * @return {string}
   */
  // @ts-expect-error
  getName() {
    return this.node.longName;
  }

  /**
   * @override
   * @return {string}
   */
  // @ts-expect-error
  getShortName() {
    return this.node.shortName;
  }

  /**
   * @override
   * @return {string}
   */
  // @ts-expect-error
  getAbsolutePath() {
    return this.absolutePath;
  }

  /**
   * @override
   * @return {boolean}
   */
  // @ts-expect-error
  isRegularFile() {
    return this.node.isRegFile;
  }

  /**
   * @override
   * @return {boolean}
   */
  // @ts-expect-error
  isDirectory() {
    return this.node.isDir;
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  length() {
    const ls = this.listFiles();
    if (ls) {
      let len = 0;
      for (let i = 0; i < ls.length; i++) {
        len += ls[i].length();
      }
      return len;
    }
    return this.node.dirEntry.FileSize;
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  getSizeOnDisk() {
    const fs = this.fs;
    const node = this.node;
    let /** @type {number} */ clusCnt = 0;
    fs.dfs(node, (it) => {
      clusCnt += fs.getClusterChainLength(it.fstClus);
    });
    if (node.isRoot) {
      clusCnt += fs.getClusterChainLength(fs.getClusNum(fs.vars.RootDirOffset));
    }
    return clusCnt * fs.vars.SizeOfCluster;
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @return {?Date}
   */
  // @ts-expect-error
  getLastModified() {
    const { dirEntry } = this.node;
    return parseDateTime(dirEntry.WrtDate, dirEntry.WrtTime, 0);
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @param {?Date} date
   */
  // @ts-expect-error
  setLastModified(date) {
    const { dirOffset, dirEntry } = this.node;
    this.fs.io
      .seek(dirOffset + DIR_WRT_DATE_TIME_OFFSET)
      .writeWord((dirEntry.WrtTime = toTime(date)))
      .writeWord((dirEntry.WrtDate = toDate(date)));
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @return {?Date}
   */
  // @ts-expect-error
  getCreationTime() {
    const { dirEntry } = this.node;
    return parseDateTime(dirEntry.CrtDate, dirEntry.CrtTime, dirEntry.CrtTimeTenth);
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @param {?Date} date
   */
  // @ts-expect-error
  setCreationTime(date) {
    const { dirOffset, dirEntry } = this.node;
    this.fs.io
      .seek(dirOffset + DIR_CRT_DATE_TIME_OFFSET)
      .writeByte((dirEntry.CrtTimeTenth = toTimeTenth(date)))
      .writeWord((dirEntry.CrtTime = toTime(date)))
      .writeWord((dirEntry.CrtDate = toDate(date)));
  }

  /**
   * yyyy.MM.dd
   * @override
   * @return {?Date}
   */
  // @ts-expect-error
  getLastAccessTime() {
    return parseDate(this.node.dirEntry.LstAccDate);
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @param {?Date} date
   */
  // @ts-expect-error
  setLastAccessTime(date) {
    const { dirOffset, dirEntry } = this.node;
    this.fs.io //
      .seek(dirOffset + DIR_LST_ACC_DATE_OFFSET)
      .writeWord((dirEntry.LstAccDate = toDate(date)));
  }

  /**
   * @override
   * @param {function(!File):boolean} predicate
   * @return {?File}
   */
  // @ts-expect-error
  findFirst(predicate) {
    let /** @type {?File} */ file = null;
    const node = this.fs.findFirstRegNode(this.node, (it) => predicate((file = this.createFile(it.longName, it))));
    return node ? file : null;
  }

  /**
   * @override
   * @param {function(!File):boolean} predicate
   * @return {?Array<!File>}
   */
  // @ts-expect-error
  findAll(predicate) {
    if (!this.node.isDir) {
      return null;
    }
    const /** @type {!Array<!File>} */ files = [];
    this.findFirst((file) => {
      if (predicate(file)) {
        files.push(file);
      }
      return false;
    });
    return files;
  }

  /**
   * @override
   * @return {?Array<!File>}
   */
  // @ts-expect-error
  listFiles() {
    return this.findAll(() => true);
  }

  /**
   * @override
   * @return {?ns.FileIO}
   */
  // @ts-expect-error
  open() {
    return this.node.isRegFile ? new FileIO(this.fs, this.node) : null;
  }

  /**
   * @override
   */
  // @ts-expect-error
  delete() {
    const node = this.node;
    const fs = this.fs;
    fs.dfs(node, (it) => {
      fs.unlink(it.fstClus);
      this.fs.markNodeDeleted(it);
    });
    if (node.isRoot) {
      const rootClusNum = fs.getClusNum(fs.vars.RootDirOffset);
      if (rootClusNum) {
        // FAT32: delele all clusters, writeZeros to the root cluster, add a label
        const label = this.fs.getLabel();
        fs.unlink(rootClusNum);
        fs.writeZeros(rootClusNum);
        fs.FAT.setNextClusNum(rootClusNum, this.fs.vars.FinalClus);
        this.fs.setLabel(label);
      }
    }
  }

  /**
   * @override
   * @param {string} relativePath
   * @return {?File}
   */
  // @ts-expect-error
  getFile(relativePath) {
    return this.traverse(relativePath, (node, name) => this.fs.findFirstRegNode(node, (it) => match(name, it)));
  }

  /**
   * @override
   * @param {string} relativePath
   * @return {?File}
   */
  // @ts-expect-error
  makeFile(relativePath) {
    return this.getOrMakeFileOrDirectory(relativePath, true);
  }

  /**
   * @override
   * @param {string} relativePath
   * @return {?File}
   */
  // @ts-expect-error
  makeDir(relativePath) {
    return this.getOrMakeFileOrDirectory(relativePath, false);
  }

  /**
   * @override
   * @param {string} dest
   * @return {?File}
   */
  // @ts-expect-error
  moveTo(dest) {
    const node = this.node;
    if (node.isRoot) {
      return null;
    }
    if (!dest.startsWith("/") && !dest.startsWith("\\")) {
      dest = this.absolutePath.substring(0, this.absolutePath.length - node.longName.length) + dest;
    }
    if (this.contains(dest)) {
      return null;
    }
    const destFile = this.fs.root.getFile(dest);
    if (destFile && destFile.node.isRegFile) {
      // dest is an existing regular file
      return null;
    }
    const isFile = !node.isRegDir;
    const target = destFile //
      ? destFile.getOrMakeFileOrDirectory(node.longName, isFile)
      : this.fs.root.getOrMakeFileOrDirectory(dest, isFile);
    if (!target) {
      return null;
    }
    const src = node;
    const dst = target.node;
    if (src.firstDirOffset === dst.firstDirOffset) {
      // nothing to move
      return target;
    }
    this.fs.unlink(dst.fstClus);
    const srcDir = src.dirEntry;
    const destDir = dst.dirEntry;
    dst.fstClus = src.fstClus;
    destDir.CrtTimeTenth = srcDir.CrtTimeTenth;
    destDir.CrtTime = srcDir.CrtTime;
    destDir.CrtDate = srcDir.CrtDate;
    destDir.LstAccDate = srcDir.LstAccDate;
    destDir.FstClusHI = srcDir.FstClusHI;
    destDir.WrtTime = srcDir.WrtTime;
    destDir.WrtDate = srcDir.WrtDate;
    destDir.FstClusLO = srcDir.FstClusLO;
    destDir.FileSize = srcDir.FileSize;
    writeDirEntry(this.fs.io, dst.dirOffset, destDir);
    this.fs.markNodeDeleted(src);
    return target;
  }

  // Private

  /**
   * @private
   * @param {string} relativePath
   * @param {boolean} isFile
   * @return {?File}
   */
  getOrMakeFileOrDirectory(relativePath, isFile) {
    return this.traverse(relativePath, (node, name, isLast) => this.fs.getOrMakeNode(node, name, isFile && isLast));
  }

  /**
   * @private
   * @param {string} absolutePath
   * @return {number}
   */
  contains(absolutePath) {
    if (this.node.isRegFile) {
      return 0;
    }
    const srcNames = split(this.absolutePath);
    const destNames = split(absolutePath);
    let i = this.fs.root;
    let j = i;
    let k = 0;
    while (true) {
      if (k === srcNames.length) {
        return 1;
      }
      if (k === destNames.length) {
        return 0;
      }
      const srcName = srcNames[k];
      const destName = destNames[k];
      const srcChild = i.findFirst((file) => match(srcName, file.node));
      const destChild = j.findFirst((file) => match(destName, file.node));
      if (!srcChild) {
        // impossible
        assert(false);
        return 0;
      }
      if (!destChild) {
        return 0;
      }
      if (srcChild.node.firstDirOffset !== destChild.node.firstDirOffset) {
        return 0;
      }
      i = srcChild;
      j = destChild;
      k++;
    }
  }

  /**
   * @private
   * @param {string} relativePath
   * @param {!FATNode} node
   * @return {!File}
   */
  createFile(relativePath, node) {
    return new File(this.fs, (this.node.isRoot ? "" : this.absolutePath) + "/" + relativePath, node);
  }

  /**
   * @private
   * @param {string} relativePath
   * @param {function(!FATNode,string,boolean):?FATNode} func
   * @return {?File}
   */
  traverse(relativePath, func) {
    let /** @type {?FATNode} */ node = this.node;
    const names = split(relativePath);
    const longNames = [];
    let i = 0;
    while (i < names.length && node) {
      node = func(node, names[i], i === names.length - 1);
      if (node) {
        longNames.push(node.longName);
      }
      i++;
    }
    return node ? this.createFile(longNames.join("/"), node) : null;
  }
}

// const FAT_FUNC = [FAT12, FAT16, FAT32]

// const createFAT = (indexBits) => {
//   if (indexBits === 12) {
//     /**
//      * @type {!FAT}
//      */
//     return new FAT12(this);
//   } else if (this.vars.IndexBits === 16) {
//     /**
//      * @constant
//      * @type {!FAT}
//      */
//     return new FAT16(this);
//   } else if (this.vars.IndexBits === 32) {
//     /**
//      * @constant
//      * @type {!FAT}
//      */
//     return new FAT32(this);
//   } else {
//     throw new Error();
//   }
// };

/**
 * @implements {ns.FileSystem}
 */
class FileSystem {
  /**
   * @param {!IO} io
   * @param {!ns.Codepage} cp
   */
  constructor(io, cp) {
    /**
     * @constant
     */
    this.io = io;
    /**
     * @constant
     */
    this.cp = cp;
    /**
     * @constant
     * @type {!BootSector}
     */
    this.bs = loadBootSector(io);
    /**
     * @constant
     * @type {!FATVariables}
     */
    this.vars = loadFATVariables(this.bs);
    /**
     * @constant
     */
    this.root = new File(this, "/", ROOT_NODE);
    /**
     * @constant
     * @type {!Array<number>}
     */
    this.offsetFATs = new Array(this.bs.bpb.NumFATs);
    for (let i = 0; i < this.bs.bpb.NumFATs; i++) {
      this.offsetFATs[i] = (this.bs.bpb.RsvdSecCnt + i * this.vars.FATSz) * this.bs.bpb.BytsPerSec;
    }

    /**
     * @type {!FAT}
     */
    // eslint-disable-next-line init-declarations
    let impl;
    if (this.vars.IndexBits === 12) {
      impl = new FAT12(this);
    } else if (this.vars.IndexBits === 16) {
      impl = new FAT16(this);
    } else if (this.vars.IndexBits === 32) {
      impl = new FAT32(this);
    } else {
      throw new Error();
    }
    /**
     * @type {!FAT}
     */
    this.FAT = impl;
  }

  // ns.FileSystem

  /**
   * @override
   * @return {string}
   */
  // @ts-expect-error
  getName() {
    return "FAT" + this.vars.IndexBits;
  }

  /**
   * @override
   * @return {string}
   */
  // @ts-expect-error
  getLabel() {
    return this.findFirstLabelNode()?.shortName ?? this.cp.decode(this.bs.VolLab).trimEnd();
  }

  /**
   * @override
   * @param {?string} label
   * @return {undefined}
   */
  // @ts-expect-error
  setLabel(label) {
    const node = this.findFirstLabelNode();
    if (label) {
      const sfn = strToUint8Array(this.cp, DIR_NAME_LENGTH, label);
      const dir = createVolumeDirEntry(sfn);
      const offset = node?.dirOffset ?? this.allocate(ROOT_NODE, 1);
      if (offset) {
        writeDirEntry(this.io, offset, dir);
      }
    } else if (node) {
      this.markNodeDeleted(node);
    }
  }

  /**
   * @override
   * @return {?string}
   */
  // @ts-expect-error
  getOEMName() {
    return this.cp.decode(this.bs.OEMName).trimEnd();
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  getId() {
    return this.bs.VolID;
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  getSizeOfCluster() {
    return this.vars.SizeOfCluster;
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  getCountOfClusters() {
    return this.vars.CountOfClusters;
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  getFreeClusters() {
    let count = 0;
    for (let i = MIN_CLUS_NUM; i <= this.vars.MaxClus; i++) {
      if (this.FAT.getNextClusNum(i) === FREE_CLUS) {
        count++;
      }
    }
    return count;
  }

  /**
   * @override
   * @return {!File}
   */
  // @ts-expect-error
  getRoot() {
    return this.root;
  }

  // Find nodes

  /**
   * @param {!FATNode} node
   * @param {function(!FATNode):boolean} predicate
   * @return {?FATNode}
   */
  findFirstRegNode(node, predicate) {
    return this.findFirstNode(node, (it) => it.isReg && predicate(it));
  }

  /**
   * @private
   * @param {!FATNode} node
   * @param {function(!FATNode):boolean} predicate
   * @return {?FATNode}
   */
  findFirstNode(node, predicate) {
    let it = this.getFirst(node);
    while (it && !predicate(it)) {
      it = this.getNext(it, 1);
    }
    return it;
  }

  /**
   * @private
   * @return {?FATNode}
   */
  findFirstLabelNode() {
    return this.findFirstNode(ROOT_NODE, (it) => it.isLabel);
  }

  // Node navigation

  /**
   * @param {!FATNode} node
   * @param {function(!FATNode):void} func
   */
  dfs(node, func) {
    let it = this.getFirst(node);
    while (it) {
      const next = this.getNext(it, 1);
      if (it.isReg) {
        this.dfs(it, func);
      }
      it = next;
    }
    if (node.isReg) {
      func(node);
    }
  }

  /**
   * @param {!FATNode} parent
   * @param {string} name
   * @param {boolean} isFile
   * @return {?FATNode}
   */
  getOrMakeNode(parent, name, isFile) {
    if (!parent.isDir) {
      log.warn(`'${parent.longName}' is not a directory`);
      return null;
    }
    const filename = normalizeLongName(name);
    if (!filename || filename.length > LFN_MAX_LEN) {
      // too short or too long
      return null;
    }
    const used = new Set();
    {
      const test = filename.toUpperCase();
      const node = this.findFirstRegNode(parent, (dir) => {
        let upper = dir.shortName.toUpperCase();
        used.add(upper);
        let found = test === upper;
        if (LFN_ENABLED && !found) {
          upper = dir.longName.toUpperCase();
          used.add(upper);
          found = test === upper;
        }
        return found;
      });
      if (node) {
        return (node.isRegFile && isFile) || (node.isRegDir && !isFile) ? node : null;
      }
    }
    // filename is unique, create a chain with respect to shortNames
    const cp = this.cp;
    let shortName = filename;
    // try cropped filename
    let sfn = strToSfn(shortName, cp);
    if (!sfn && filename !== (shortName = shortName.toUpperCase())) {
      // try cropped and upper case
      sfn = strToSfn(shortName, cp);
    }
    if (!sfn) {
      // tilde-name is always correct
      sfn = strToSfn((shortName = strToTildeName(filename, cp, used)), cp);
    }
    if (!sfn) {
      return impossibleNull();
    }

    return this.makeNode(parent, isFile, shortName, filename, sfn);
  }

  /**
   * @param {!FATNode} node
   */
  markNodeDeleted(node) {
    assert(node.isLabel || node.isReg);
    const { io } = this;
    if (LFN_ENABLED) {
      // mark all elements in the chain by setting 0xE5 to the first byte
      // it is possible that the chain spans across multiple non-contiguous clusters
      let i = 0;
      let offset = node.firstDirOffset;
      do {
        io.seek(offset).writeByte(DIR_ENTRY_FLAG_DELETED);
      } while (++i < node.dirCount && (offset = this.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE)));
    } else {
      io.seek(node.dirOffset).writeByte(DIR_ENTRY_FLAG_DELETED);
    }
  }

  /**
   * @private
   * @param {!FATNode} parent
   * @param {boolean} isFile
   * @param {string} shortName
   * @param {string} longName
   * @param {!Uint8Array} sfn
   * @return {?FATNode}
   */
  makeNode(parent, isFile, shortName, longName, sfn) {
    /**
     * @type {!Array<!DirEntryLFN>}
     */
    const dirLFNs = [];
    if (LFN_ENABLED && longName !== shortName) {
      // we need a chain LFN
      const lfn = strToLfn(longName);
      if (!lfn) {
        // invalid LFN character
        return null;
      }
      const Chksum = getChkSum(sfn);
      let i = 0;
      while (i < lfn.length) {
        dirLFNs.push({
          Ord: 1 + dirLFNs.length,
          Name1: lfn.subarray(i, (i += LFN_NAME1_LENGTH)),
          Attributes: DIR_ENTRY_ATTR_LFN,
          Type: 0,
          Chksum,
          Name2: lfn.subarray(i, (i += LFN_NAME2_LENGTH)),
          FstClusLO: 0,
          Name3: lfn.subarray(i, (i += LFN_NAME3_LENGTH)),
        });
      }
      const last = dirLFNs[dirLFNs.length - 1];
      // for filename length 255, there are only 20 dirLFN entries
      assert(last.Ord < DIR_LN_LAST_LONG_ENTRY);
      last.Ord |= DIR_LN_LAST_LONG_ENTRY;
    }

    const dirCount = dirLFNs.length + 1;
    const firstDirOffset = this.allocate(parent, dirCount);
    if (!firstDirOffset) {
      // no free space
      return null;
    }

    const io = this.io;
    const dirEntry = createDirEntry(sfn, new Date());
    if (!isFile) {
      // create "." and ".." dir entries
      const clusNum = this.allocateCluster();
      if (!clusNum) {
        // no free space
        // we extended "parent" by 1 cluster probably, don't rollback it
        return null;
      }
      const clusOffset = this.writeZeros(clusNum);
      assert(clusOffset > 0);
      dirEntry.FstClusLO = clusNum & 0xffff;
      dirEntry.FstClusHI = clusNum >>> 16;
      dirEntry.Attributes = DIR_ENTRY_ATTR_DIRECTORY;
      writeDirEntry(io, clusOffset, createDotDirEntry(DOT_SFN, dirEntry));
      writeDirEntry(io, clusOffset + DIR_ENTRY_SIZE, createDotDirEntry(DOT_DOT_SFN, parent.dirEntry));
    }

    // write dirEntry
    let offset = firstDirOffset;
    if (LFN_ENABLED) {
      const len = dirLFNs.length;
      for (let i = 0; i < len; i++) {
        writeDirEntryLFN(io, offset, dirLFNs[len - 1 - i]);
        offset = this.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE);
        assert(offset > 0);
      }
    }
    writeDirEntry(io, offset, dirEntry);
    const kind = isFile ? NODE_REG_FILE : NODE_REG_DIR;
    const node = createNode(kind, shortName, offset, dirEntry);
    if (LFN_ENABLED) {
      node.longName = longName;
      node.firstDirOffset = firstDirOffset;
      node.dirCount = dirCount;
    }
    return node;
  }

  /**
   * @private
   * @param {!FATNode} node
   * @param {number} dirCount
   * @return {number} offset or 0 if cannot allocate
   */
  allocate(node, dirCount) {
    assert(node.isDir);
    let /** @type {number} */ firstDirOffset = 0;
    let /** @type {number} */ allocated = 0;
    const { io, vars } = this;
    let offset = vars.RootDirOffset;
    if (node.isRegDir) {
      assert(node.fstClus > 0);
      offset = this.getContentOffset(node.fstClus);
    }
    let lastOffset = offset;
    while (offset) {
      lastOffset = offset;
      const flag = io.seek(offset).readByte();
      if (flag === DIR_ENTRY_FLAG_LAST || flag === DIR_ENTRY_FLAG_DELETED) {
        if (allocated === 0) {
          firstDirOffset = offset;
        }
        allocated++;
        if (allocated >= dirCount) {
          return firstDirOffset;
        }
      } else {
        allocated = 0;
      }
      offset = this.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE);
    }
    // we have reached the end of directory and need to allocate 1 or 2 clusters: 32*(20+1)=672 bytes maximum
    // find the last cluster number
    const lastClus = this.getClusNum(lastOffset);
    if (!lastClus) {
      assert(this.vars.IndexBits !== 32 && node.isRoot);
      // node is a root directory on FAT12 and FAT16 has no clusters
      return 0;
    }
    assert(this.vars.IndexBits === 32 || !node.isRoot);
    // the number of bytes left to allocate
    const allocateSize = (dirCount - allocated) * DIR_ENTRY_SIZE;
    assert(allocateSize > 0);

    const allocateClusCnt = Math.ceil(allocateSize / this.vars.SizeOfCluster);
    assert(allocateClusCnt === 1 || allocateClusCnt === 2);

    // attach 1 cluster
    const clus1 = this.allocateCluster();
    if (!clus1) {
      // no space left
      return 0;
    }
    this.writeZeros(clus1);
    this.FAT.setNextClusNum(lastClus, clus1);
    if (allocateClusCnt === 2) {
      const clus2 = this.allocateCluster();
      if (!clus2) {
        // no space left
        return 0;
      }
      this.writeZeros(clus2);
      this.FAT.setNextClusNum(clus1, clus2);
    }
    return allocated > 0 ? firstDirOffset : this.getContentOffset(clus1);
  }

  /**
   * @private
   * @param {!FATNode} node
   * @return {?FATNode}
   */
  getFirst(node) {
    if (node.isRoot) {
      return this.loadFromOffset(this.vars.RootDirOffset);
    }
    if (node.isRegDir) {
      const offset = this.getContentOffset(node.fstClus);
      if (offset) {
        return this.loadFromOffset(offset);
      }
      // directory has a wrong first cluster number?
    }
    return null;
  }

  /**
   * @private
   * @param {!FATNode} node
   * @param {number} noLast
   * @return {?FATNode}
   */
  getNext(node, noLast) {
    const lastDirOffset = node.dirOffset;
    if (lastDirOffset > 0) {
      const offset = this.getNextDirEntryOffset(lastDirOffset + DIR_ENTRY_SIZE);
      if (offset) {
        const next = this.loadFromOffset(offset);
        return noLast && next?.isLast ? null : next;
      }
    }
    return null;
  }

  /**
   * @private
   * @param {number} firstDirOffset
   * @return {?FATNode}
   */
  loadFromOffset(firstDirOffset) {
    const node = this.getNextNode(firstDirOffset);
    assert(!node || node.firstDirOffset === firstDirOffset);
    assert(!node || node.dirCount > 0);
    return node;
  }

  /**
   * @private
   * @param {number} firstDirOffset
   * @return {?FATNode}
   */
  getNextNode(firstDirOffset) {
    const { io } = this;
    /**
     * @type {!Array<!DirEntryLFN>}
     */
    const chain = [];
    let offset = firstDirOffset;
    while (offset) {
      const flag = io.seek(offset).readByte();
      io.skip(-1);
      if (LFN_ENABLED && flag !== DIR_ENTRY_FLAG_LAST && flag !== DIR_ENTRY_FLAG_DELETED && isDirEntryLFN(io)) {
        const dirLFN = loadDirEntryLFN(io);
        if (dirLFN.Ord & DIR_LN_LAST_LONG_ENTRY) {
          if (chain.length) {
            log.warn(`Skip invalid chainLFN at ${firstDirOffset}: new chain started`);
          }
          chain.length = 0;
          chain.push(dirLFN);
        } else if (chain.length) {
          const prev = chain[chain.length - 1].Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
          const curr = dirLFN.Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
          if (prev === curr + 1) {
            chain.push(dirLFN);
          } else {
            log.warn(`Skip invalid chainLFN at ${firstDirOffset}: order mismatch`);
            chain.length = 0;
          }
        } else {
          log.warn(`Skip invalid dirLFN at ${offset}: chain is empty`);
        }
      } else {
        // simple node: last node of the chain, or not LFN, or deleted, etc
        const node = this.readNode(offset);
        if (node) {
          // node is valid, fill LFN if needed
          fillNode(node, chain, firstDirOffset);
          return node;
        }
        log.warn(`Skip invalid node at ${offset}`);
      }
      offset = this.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE);
    }
    // EOF
    return null;
  }

  /**
   * @private
   * @param {number} offset
   * @return {?FATNode}
   */
  readNode(offset) {
    const { io, cp } = this;
    const flag = io.seek(offset).readByte();
    io.skip(-1);

    if (flag === DIR_ENTRY_FLAG_LAST) {
      return createNode(NODE_LAST, "", offset, DUMMY_DIR);
    }

    if (flag === DIR_ENTRY_FLAG_DELETED) {
      return createNode(NODE_DELETED, "", offset, DUMMY_DIR);
    }

    const dir = loadDirEntry(io);
    const dirName = dir.Name;
    const dirAttributes = dir.Attributes;

    const isLabel = (dirAttributes & DIR_ENTRY_ATTR_VOLUME_ID) > 0;
    if (isLabel) {
      return createNode(NODE_LABEL, cp.decode(dirName).trimEnd(), offset, dir);
    }

    const isDir = (dirAttributes & DIR_ENTRY_ATTR_DIRECTORY) > 0;
    if (isDir && dirName.every((it, i) => it === DOT_SFN[i])) {
      return createNode(NODE_DOT_DIR, ".", offset, dir);
    }
    if (isDir && dirName.every((it, i) => it === DOT_DOT_SFN[i])) {
      return createNode(NODE_DOT_DIR, "..", offset, dir);
    }

    if (dirName.every(isShortNameValidCode)) {
      const shortName = sfnToStr(dirName, cp);
      if (shortName && !shortName.startsWith(" ")) {
        return createNode(isDir ? NODE_REG_DIR : NODE_REG_FILE, shortName, offset, dir);
      }
    }

    // invalid node
    return null;
  }

  // Math

  /**
   * @param {number} clusNum
   * @return {number}
   */
  getContentOffset(clusNum) {
    if (clusNum >= MIN_CLUS_NUM && clusNum <= this.vars.MaxClus) {
      return this.bs.bpb.BytsPerSec * (this.vars.FirstDataSec + (clusNum - MIN_CLUS_NUM) * this.bs.bpb.SecPerClus);
    }
    // not allocated
    return 0;
  }

  /**
   * @param {number} clusNum
   * @return {number}
   */
  getClusterChainLength(clusNum) {
    let count = 0;
    while (clusNum >= MIN_CLUS_NUM && clusNum <= this.vars.MaxClus) {
      count++;
      clusNum = this.FAT.getNextClusNum(clusNum);
    }
    return count;
  }

  /**
   * @param {number} clusNum
   */
  unlink(clusNum) {
    while (clusNum >= MIN_CLUS_NUM && clusNum <= this.vars.MaxClus) {
      const nextClusNum = this.FAT.getNextClusNum(clusNum);
      this.FAT.setNextClusNum(clusNum, FREE_CLUS);
      clusNum = nextClusNum;
    }
  }

  /**
   * @param {number} clusNum
   * @return {number}
   */
  writeZeros(clusNum) {
    const offset = this.getContentOffset(clusNum);
    assert(offset > 0);
    this.io.seek(offset).writeBytes(0, this.vars.SizeOfCluster);
    return offset;
  }

  /**
   * @return {number}
   */
  allocateCluster() {
    const nxtFreeClus = this.FAT.getNextFreeClus();
    let i = nxtFreeClus;
    // [nxtFreeClus, MaxClus]
    while (i <= this.vars.MaxClus && this.FAT.getNextClusNum(i) !== FREE_CLUS) {
      i++;
    }
    if (i > this.vars.MaxClus) {
      // [2, nxtFreeClus)
      i = MIN_CLUS_NUM;
      while (i < nxtFreeClus && this.FAT.getNextClusNum(i) !== FREE_CLUS) {
        i++;
      }
      if (i >= nxtFreeClus) {
        // no space left
        return 0;
      }
    }
    this.FAT.setNextFreeClus(i + 1);
    this.FAT.setNextClusNum(i, this.vars.FinalClus);
    return i;
  }

  /**
   * @param {number} offset
   * @return {number}
   */
  getClusNum(offset) {
    assert(offset >= 0);
    assert(Number.isInteger(offset));
    const secNum = Math.floor(offset / this.bs.bpb.BytsPerSec);
    const dataSecNum = secNum - this.vars.FirstDataSec;
    return dataSecNum < 0
      ? 0 // the offset is in the root directory on FAT12 or FAT16: there is no clusNum
      : MIN_CLUS_NUM + Math.floor(dataSecNum / this.bs.bpb.SecPerClus);
  }

  /**
   * @private
   * @param {number} offset
   * @return {number}
   */
  getNextDirEntryOffset(offset) {
    assert(offset > 512 && offset % DIR_ENTRY_SIZE === 0);
    const { BytsPerSec, SecPerClus } = this.bs.bpb;
    const { FirstDataSec } = this.vars;
    // if the offset points to the first byte of the cluster, treat it as 'overflow'
    // in this case, retrieve the next cluster from the first FAT table
    // note: There is an exception for the root directory, which has a flat structure for FAT12 and FAT16
    if (offset % BytsPerSec !== 0) {
      // the offset is within the sector: no overflow
      return offset;
    }
    const secNum = offset / BytsPerSec;
    assert(Number.isInteger(secNum));
    if (secNum < FirstDataSec) {
      // the offset is within the root directory on FAT12 or FAT16: no further FAT table lookups are necessary
      return offset;
    }
    if (secNum === FirstDataSec) {
      // we have reached the end of the root directory: EOF
      return 0;
    }
    const dataSecNum = secNum - FirstDataSec;
    if (dataSecNum % SecPerClus !== 0) {
      // the offset doesn't point to the first byte of the cluster: no overflow
      return offset;
    }
    // [0 1 2 ...
    // [2 3 4 ...
    //      ^
    //      overflow at N=2, N+1 is the cluster number before overflow
    const clusNum = 1 + dataSecNum / SecPerClus;
    assert(Number.isInteger(clusNum));
    const nexClusNum = this.FAT.getNextClusNum(clusNum);
    return this.getContentOffset(nexClusNum);
  }
}

// Export

/**
 * @param {!IO} io
 * @param {!ns.Codepage} cp
 * @return {?ns.FileSystem}
 */
export const createFileSystem = (io, cp) => {
  /**
   * @type {?ns.FileSystem}
   */
  let fs = null;
  try {
    fs = new FileSystem(io, cp);
  } catch (/** @type {!*} */ e) {
    log.warn("No FileSystem", e);
  }
  return fs;
};
