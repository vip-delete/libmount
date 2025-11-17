import {
  DIR_ENTRY_ATTR_DIRECTORY,
  DIR_ENTRY_ATTR_LFN,
  DIR_ENTRY_ATTR_VOLUME_ID,
  DIR_ENTRY_FLAG_DELETED,
  DIR_ENTRY_FLAG_LAST,
  DIR_ENTRY_SIZE,
  DIR_ENTRY_SIZE_BITS,
  DIR_NAME_LENGTH,
  FAT_THRESHOLD,
  FREE_CLUS,
  FSI_NEXT_FREE_OFFSET,
  LFN_MAX_LEN,
  LFN_NAME1_LENGTH,
  LFN_NAME2_LENGTH,
  LFN_NAME3_LENGTH,
  MIN_CLUS_NUM,
  SZ,
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
import { createIO } from "./io.mjs";
// import { createLogger } from "./log.mjs";
import { BootSector, DirEntry, DirEntryLFN, Driver, FAT, FATNode, FATVariables, IO, ValidationError } from "./types.mjs";
import {
  assert,
  getChkSum,
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

// /**
//  * @type {!Logger}
//  */
// const log = createLogger("FS");

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
 * @param {!IO} io
 * @param {number} flag
 * @param {number} offset
 * @param {!ns.Codepage} cp
 * @return {?FATNode}
 */
const readNode = (io, flag, offset, cp) => {
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
};

/**
 * @param {!Driver} driver
 * @param {number} offset
 * @param {!DirEntry} dirEntry
 */
const flushDirEntry = (driver, offset, dirEntry) => {
  const array = new Uint8Array(DIR_ENTRY_SIZE);
  const io = createIO(array);
  writeDirEntry(io, 0, dirEntry);
  driver.writeUint8Array(offset, array);
};

/**
 * @param {!Driver} driver
 * @param {!FATNode} node
 */
const flushNode = (driver, node) => {
  flushDirEntry(driver, node.dirOffset, node.dirEntry);
};

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
        // log.warn(`Skip invalid chainLFN at ${firstDirOffset}: chksum mismatch`);
      }
    } else {
      // log.warn(`Skip invalid chainLFN at ${firstDirOffset}: chain is not finished`);
    }
  }
};

/**
 * @implements {FAT}
 */
class FAT12 {
  /**
   * @param {!Driver} driver
   * @param {!FATVariables} vars
   * @param {!Array<number>} offsetFATs
   */
  constructor(driver, vars, offsetFATs) {
    /** @constant */ this.driver = driver;
    /** @constant */ this.vars = vars;
    /** @constant */ this.offsetFATs = offsetFATs;
  }

  /**
   * @override
   * @param {number} clusNum
   * @return {number}
   */
  // @ts-expect-error
  getNextClusNum(clusNum) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    const val = driver.readWord(offsetFATs[0] + clusNum + (clusNum >> 1));
    return clusNum & 1 ? val >> 4 : val & vars.FinalClus;
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  // @ts-expect-error
  setNextClusNum(clusNum, value) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    for (let i = 0; i < offsetFATs.length; i++) {
      const address = offsetFATs[i] + clusNum + (clusNum >> 1);
      const val = driver.readWord(address);
      driver.writeWord(address, clusNum & 1 ? (value << 4) | (val & 0xf) : (val & 0xf000) | value);
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
   * @param {!Driver} driver
   * @param {!FATVariables} vars
   * @param {!Array<number>} offsetFATs
   */
  constructor(driver, vars, offsetFATs) {
    /** @constant */ this.driver = driver;
    /** @constant */ this.vars = vars;
    /** @constant */ this.offsetFATs = offsetFATs;
  }

  /**
   * @override
   * @param {number} clusNum
   * @return {number}
   */
  // @ts-expect-error
  getNextClusNum(clusNum) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    return driver.readWord(offsetFATs[0] + clusNum * 2);
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  // @ts-expect-error
  setNextClusNum(clusNum, value) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    for (let i = 0; i < offsetFATs.length; i++) {
      driver.writeWord(offsetFATs[i] + clusNum * 2, value);
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
   * @param {!Driver} driver
   * @param {!FATVariables} vars
   * @param {!Array<number>} offsetFATs
   * @param {number} fsiOffset
   * @param {number} fsiNxtFreeOffset
   */
  constructor(driver, vars, offsetFATs, fsiOffset, fsiNxtFreeOffset) {
    /** @constant */ this.driver = driver;
    /** @constant */ this.vars = vars;
    /** @constant */ this.offsetFATs = offsetFATs;
    /** @constant */ this.fsiOffset = fsiOffset;
    /** @constant */ this.fsiNxtFreeOffset = fsiNxtFreeOffset;
  }

  /**
   * @override
   * @param {number} clusNum
   * @return {number}
   */
  // @ts-expect-error
  getNextClusNum(clusNum) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    return driver.readDoubleWord(offsetFATs[0] + clusNum * 4) & vars.FinalClus;
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  // @ts-expect-error
  setNextClusNum(clusNum, value) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    for (let i = 0; i < offsetFATs.length; i++) {
      const address = offsetFATs[i] + clusNum * 4;
      const val = driver.readDoubleWord(address);
      driver.writeDoubleWord(address, (val & 0xf0000000) | value);
    }
  }

  /**
   * @override
   * @return  {number}
   */
  // @ts-expect-error
  getNextFreeClus() {
    const { driver, vars, fsiNxtFreeOffset } = this;
    const clusNum = driver.readDoubleWord(fsiNxtFreeOffset);
    return clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus ? clusNum : MIN_CLUS_NUM;
  }

  /**
   * @override
   * @param {number} clusNum
   */
  // @ts-expect-error
  setNextFreeClus(clusNum) {
    const { driver, fsiNxtFreeOffset } = this;
    driver.writeDoubleWord(fsiNxtFreeOffset, clusNum);
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
        buf.set(fs.driver.readUint8Array(offset, len));
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
      flushNode(this.fs.driver, this.node);
    }
    fs.driver.writeUint8Array(offset, buf.subarray(0, len));
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
    flushNode(this.fs.driver, this.node);

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
    const { dirEntry } = this.node;
    this.node.fstClus = clusNum;
    dirEntry.FstClusHI = clusNum >>> 16;
    dirEntry.FstClusLO = clusNum & 0xffff;
    flushNode(this.fs.driver, this.node);
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
    const { dirEntry } = this.node;
    dirEntry.WrtTime = toTime(date);
    dirEntry.WrtDate = toDate(date);
    flushNode(this.fs.driver, this.node);
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
    const { dirEntry } = this.node;
    dirEntry.CrtTimeTenth = toTimeTenth(date);
    dirEntry.CrtTime = toTime(date);
    dirEntry.CrtDate = toDate(date);
    flushNode(this.fs.driver, this.node);
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
    const { dirEntry } = this.node;
    dirEntry.LstAccDate = toDate(date);
    flushNode(this.fs.driver, this.node);
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
        // FAT32: delete all clusters, writeZeros to the root cluster, add a label
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
      // convert relative path to the absolute path
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
    flushDirEntry(this.fs.driver, dst.dirOffset, destDir);
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

/**
 * @implements {ns.FileSystem}
 */
class FileSystem {
  /**
   * @param {!Driver} driver
   * @param {!BootSector} bs
   * @param {!FATVariables} vars
   * @param {!FAT} fat
   * @param {!ns.Codepage} cp
   */
  constructor(driver, bs, vars, fat, cp) {
    /**
     * @constant
     */
    this.driver = driver;
    /**
     * @constant
     */
    this.bs = bs;
    /**
     * @constant
     */
    this.cp = cp;
    /**
     * @constant
     */
    this.vars = vars;
    /**
     * @constant
     */
    this.root = new File(this, "/", ROOT_NODE);
    /**
     * @constant
     */
    this.FAT = fat;
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
      const dirEntry = createVolumeDirEntry(sfn);
      const offset = node?.dirOffset ?? this.allocate(ROOT_NODE, 1);
      if (offset) {
        flushDirEntry(this.driver, offset, dirEntry);
      } else {
        // setting a label failed: no space
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
      // log.warn(`'${parent.longName}' is not a directory`);
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
      assert(false);
      return null;
    }

    return this.makeNode(parent, isFile, shortName, filename, sfn);
  }

  /**
   * @param {!FATNode} node
   */
  markNodeDeleted(node) {
    assert(node.isLabel || node.isReg);
    const { driver } = this;
    if (LFN_ENABLED) {
      // mark all elements in the chain by setting 0xE5 to the first byte
      // it is possible that the chain spans across multiple non-contiguous clusters
      let offset = node.firstDirOffset;
      for (let i = 0; i < node.dirCount && offset > 0; i++) {
        driver.writeByte(offset, DIR_ENTRY_FLAG_DELETED);
        offset = this.getNextDirEntryOffset(offset) ?? this.getNextDirEntryOffsetFromNextClusNum(offset);
      }
    } else {
      driver.writeByte(node.dirOffset, DIR_ENTRY_FLAG_DELETED);
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
      const array = new Uint8Array(2 * DIR_ENTRY_SIZE);
      const io = createIO(array);
      writeDirEntry(io, 0, createDotDirEntry(DOT_SFN, dirEntry));
      writeDirEntry(io, DIR_ENTRY_SIZE, createDotDirEntry(DOT_DOT_SFN, parent.dirEntry));
      this.driver.writeUint8Array(clusOffset, array);
    }

    // write dirEntry
    let offset = firstDirOffset;
    if (LFN_ENABLED) {
      // dirLFNs may not be stored sequentially on disk
      const len = dirLFNs.length;
      for (let i = 0; i < len; i++) {
        const array = new Uint8Array(DIR_ENTRY_SIZE);
        const io = createIO(array);
        writeDirEntryLFN(io, 0, dirLFNs[len - 1 - i]);
        this.driver.writeUint8Array(offset, array);
        offset = this.getNextDirEntryOffset(offset) ?? this.getNextDirEntryOffsetFromNextClusNum(offset);
        assert(offset > 0);
      }
    }
    flushDirEntry(this.driver, offset, dirEntry);
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
    const { driver, vars } = this;
    let offset = vars.RootDirOffset;
    if (node.isRegDir) {
      assert(node.fstClus > 0);
      offset = this.getContentOffset(node.fstClus);
    }
    let lastOffset = offset;
    while (offset) {
      lastOffset = offset;
      // TODO: implement 512 chunk processing instead of async every 32 bytes, RootDirOffset is different case
      const flag = driver.readByte(offset);
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
      offset = this.getNextDirEntryOffset(offset) ?? this.getNextDirEntryOffsetFromNextClusNum(offset);
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
      const offset = this.getNextDirEntryOffset(lastDirOffset) ?? this.getNextDirEntryOffsetFromNextClusNum(lastDirOffset);
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
    const { driver } = this;
    /**
     * @type {!Array<!DirEntryLFN>}
     */
    const chain = [];
    let offset = firstDirOffset;
    let skipped = 0;
    while (offset) {
      // TODO: implement 512-bytes chunk processing instead of doing async every 32 bytes
      const array = driver.readUint8Array(offset, DIR_ENTRY_SIZE);
      const io = createIO(array);
      const flag = array[0];
      if (LFN_ENABLED && flag !== DIR_ENTRY_FLAG_LAST && flag !== DIR_ENTRY_FLAG_DELETED && isDirEntryLFN(io)) {
        const dirLFN = loadDirEntryLFN(io);
        if (dirLFN.Ord & DIR_LN_LAST_LONG_ENTRY) {
          if (chain.length) {
            // log.warn(`Skip invalid chainLFN at ${firstDirOffset}: new chain started`);
            skipped += chain.length;
          }
          chain.length = 0;
          chain.push(dirLFN);
        } else if (chain.length) {
          const prev = chain[chain.length - 1].Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
          const curr = dirLFN.Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
          if (prev === curr + 1) {
            chain.push(dirLFN);
          } else {
            // log.warn(`Skip invalid chainLFN at ${firstDirOffset}: order mismatch`);
            skipped += chain.length;
            chain.length = 0;
          }
        } else {
          // log.warn(`Skip invalid dirLFN at ${offset}: chain is empty`);
          skipped++;
        }
      } else {
        // simple node: last node of the chain, or not LFN, or deleted, etc
        const node = readNode(io, flag, offset, this.cp);
        if (node) {
          // node is valid, fill LFN if needed
          fillNode(node, chain, firstDirOffset);
          assert(node.dirCount > 0);
          assert(node.firstDirOffset === firstDirOffset + skipped * DIR_ENTRY_SIZE);
          return node;
        }
        // log.warn(`Skip invalid node at ${offset}`);
        skipped++;
      }
      offset = this.getNextDirEntryOffset(offset) ?? this.getNextDirEntryOffsetFromNextClusNum(offset);
    }
    // EOF
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
    this.driver.writeBytes(offset, 0, this.vars.SizeOfCluster);
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
   * @return {?number}
   */
  getNextDirEntryOffset(offset) {
    offset += DIR_ENTRY_SIZE;
    assert(offset > SZ && offset % DIR_ENTRY_SIZE === 0);
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
    return null;
  }

  /**
   * @private
   * @param {number} offset
   * @return {number}
   */
  getNextDirEntryOffsetFromNextClusNum(offset) {
    offset += DIR_ENTRY_SIZE;
    assert(offset > SZ && offset % DIR_ENTRY_SIZE === 0);
    const { BytsPerSec, SecPerClus } = this.bs.bpb;
    const { FirstDataSec } = this.vars;
    assert(offset % BytsPerSec === 0);
    const secNum = offset / BytsPerSec;
    assert(Number.isInteger(secNum));
    assert(secNum > FirstDataSec);
    const dataSecNum = secNum - FirstDataSec;
    assert(dataSecNum % SecPerClus === 0);
    const clusNum = 1 + dataSecNum / SecPerClus;
    assert(Number.isInteger(clusNum));
    const nexClusNum = this.FAT.getNextClusNum(clusNum);
    return this.getContentOffset(nexClusNum);
  }
}

// Export

/**
 * @param {!Driver} driver
 * @param {!ns.Codepage} cp
 * @return {?ns.FileSystem}
 */
export const createFileSystem = (driver, cp) => {
  if (driver.len() < SZ) {
    return null;
  }
  try {
    const array = driver.readUint8Array(0, SZ);
    const io = createIO(array);
    const bs = loadBootSector(io);
    const vars = loadFATVariables(bs);
    /**
     * @type {!Array<number>}
     */
    const offsetFATs = new Array(bs.bpb.NumFATs);
    for (let i = 0; i < bs.bpb.NumFATs; i++) {
      offsetFATs[i] = (bs.bpb.RsvdSecCnt + i * vars.FATSz) * bs.bpb.BytsPerSec;
    }
    /**
     * @type {!FAT}
     */
    // eslint-disable-next-line init-declarations
    let fat;
    if (vars.IndexBits === 12) {
      fat = new FAT12(driver, vars, offsetFATs);
    } else if (vars.IndexBits === 16) {
      fat = new FAT16(driver, vars, offsetFATs);
    } else if (vars.IndexBits === 32) {
      const fsiOffset = bs.bpb.BytsPerSec * bs.bpb.FSInfo;
      const fsiNxtFreeOffset = fsiOffset + FSI_NEXT_FREE_OFFSET;
      // validate FSInfo structure
      loadFSI(createIO(driver.readUint8Array(fsiOffset, SZ)));
      fat = new FAT32(driver, vars, offsetFATs, fsiOffset, fsiNxtFreeOffset);
    } else {
      throw new ValidationError();
    }
    return new FileSystem(driver, bs, vars, fat, cp);
    // @ts-expect-error
  } catch (/** @type {!Error} */ e) {
    if (e.name === "ValidationError") {
      // log.warn("No FileSystem", e);
      return null;
    }
    throw e;
  }
};
