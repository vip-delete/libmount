import {
  BiosParameterBlock,
  BiosParameterBlockFAT32,
  DirEntry,
  DirEntryLFN,
  FATDriver,
  FATNode,
  FATNodeKind,
  loadBootSector,
  loadDirEntry,
  loadDirEntryLFN,
  loadFATVariables,
} from "./model.mjs";
import { assert, validate } from "./support.mjs";
import { getChkSum, getRawName, getShortName, isNameValid } from "./util.mjs";
import { BlockDevice } from "./io.mjs";

const DIR_LN_LAST_LONG_ENTRY = 0x40;

class FATChainLFN {
  constructor() {
    this.reset();
  }

  /**
   * @param {!DirEntryLFN} dirEntryLFN
   */
  addDirEntryLFN(dirEntryLFN) {
    if (dirEntryLFN.Ord & DIR_LN_LAST_LONG_ENTRY) {
      // LFN chain has started
      this.list = [dirEntryLFN];
      return;
    }
    if (!this.list) {
      // skip invalid LFN
      return;
    }
    const prev = this.list.at(-1).Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
    const curr = dirEntryLFN.Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
    if (prev !== curr + 1) {
      // skip invalid LFN
      this.reset();
      return;
    }
    // LFN is correct
    this.list.push(dirEntryLFN);
  }

  /**
   * @param {!DirEntry} dirEntry
   */
  addDirEntry(dirEntry) {
    if (!this.list) {
      // no chain: skip
      return;
    }
    const ord = this.list.at(-1).Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
    if (ord !== 1 || this.list.at(-1).Chksum !== getChkSum(dirEntry.Name)) {
      // previous LFN is not first or checksum doesn't match: the LFN is invalid
      this.reset();
    }
  }

  /**
   * @returns {undefined}
   */
  reset() {
    /**
     * @type {?Array<!DirEntryLFN>}
     */
    this.list = null;
  }

  /**
   * @returns {number}
   */
  size() {
    return this.list?.length ?? 0;
  }

  /**
   * @returns {?string}
   */
  getLongName() {
    if (!this.list) {
      // no chain: no long name
      return null;
    }
    let longName = "";
    let k = this.list.length - 1;
    while (k >= 0) {
      const dir = this.list[k];
      /**
       * @type {!Array<!Uint8Array>}
       */
      const arr = [dir.Name1, dir.Name2, dir.Name3];
      for (let i = 0; i < arr.length; i++) {
        const part = arr[i];
        for (let j = 0; j < part.length; j += 2) {
          const b1 = part[j];
          const b2 = part[j + 1];
          if (b1 === 0 && b2 === 0) {
            return longName;
          }
          const ch = b1 | (b2 << 8);
          longName += String.fromCharCode(ch);
        }
      }
      k--;
    }
    return longName;
  }
}

/**
 * @enum
 */
const DirEntryFlag = {
  LAST_ENTRY: 0x00,
  FREE_ENTRY: 0xe5,
};

/**
 * @enum
 */
const DirEntryAttr = {
  READ_ONLY: 0x01,
  HIDDEN: 0x02,
  SYSTEM: 0x04,
  VOLUME_ID: 0x08,
  DIRECTORY: 0x10,
  ARCHIVE: 0x20,
  // READ_ONLY | HIDDEN | SYSTEM | VOLUME_ID
  LONG_NAME: 0xf,
};

const MIN_CLUS_NUM = 2;
const FREE_CLUS = 0;

const FAT_DRIVER_EOF = -1;
const DIR_ENTRY_SIZE = 32;

/**
 * @implements {FATDriver}
 */
export class GnericFATDriver {
  /**
   * @param {!BlockDevice} s
   * @param {string} encoding
   */
  constructor(s, encoding) {
    this.s = s;
    this.s.pos = 0;
    this.bs = loadBootSector(s);
    this.vars = loadFATVariables(this.bs);
    this.encoding = encoding;
    validateBiosParameterBlock(this.bs.bpb);
    if (this.vars.CountOfClusters < 4085) {
      // A FAT12 volume cannot contain more than 4084 clusters.
      this.fileSystemName = "FAT12";
      this.getNextClusNum = this.getNextClusNum12;
      this.setNextClusNum = this.setNextClusNum12;
    } else if (this.vars.CountOfClusters < 65525) {
      // A FAT16 volume cannot contain less than 4085 clusters or more than 65,524 clusters.
      this.fileSystemName = "FAT16";
      this.getNextClusNum = this.getNextClusNum16;
      this.setNextClusNum = this.setNextClusNum16;
    } else {
      validateBiosParameterBlockFAT32(this.bs.bpbFAT32);
      this.fileSystemName = "FAT32";
      this.getNextClusNum = this.getNextClusNum32;
      this.setNextClusNum = this.setNextClusNum32;
    }
  }

  /**
   * @override
   * @returns {string}
   */
  getFileSystemName() {
    return this.fileSystemName;
  }

  /**
   * @override
   * @returns {!lm.VolumeInfo}
   */
  getVolumeInfo() {
    return {
      label: this.getVolumName(),
      serialNumber: this.bs.VolID,
      clusterSize: this.vars.SizeOfCluster,
      totalClusters: this.vars.CountOfClusters,
      freeClusters: this.getCountOfFreeClusters(),
    };
  }

  /**
   * @override
   * @returns {!FATNode}
   */
  getRoot() {
    return new FATNode(FATNodeKind.ROOT, "", null, FAT_DRIVER_EOF, 0, null);
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getNext(node) {
    return node.isRoot() ? null : this.loadFromOffset(this.getNextOffset(node.offset + node.dirs * DIR_ENTRY_SIZE));
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getFirst(node) {
    if (node.isRoot()) {
      return this.loadFromOffset(this.bs.bpb.BytsPerSec * this.vars.FirstRootDirSecNum);
    }
    if (node.isRegularDirectory()) {
      return this.loadFromOffset(this.getContentOffset(node.getClusNum()));
    }
    return null;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?Uint8Array}
   */
  readNode(node) {
    if (!node.isRegularFile()) {
      return null;
    }
    const fileSize = node.getFileSize();
    let clusNum = node.getClusNum();
    let size = 0;
    const arr = new Uint8Array(new ArrayBuffer(fileSize));
    while (size < fileSize) {
      const offset = this.getContentOffset(clusNum);
      if (offset === FAT_DRIVER_EOF) {
        // premature EOF, FileSize is not correct
        break;
      }
      const len = Math.min(this.vars.SizeOfCluster, fileSize - size);
      this.s.pos = offset;
      const chunk = this.s.readArray(len);
      arr.set(chunk, size);
      size += len;
      clusNum = this.getNextClusNum(clusNum);
    }
    return arr;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {undefined}
   */
  deleteNode(node) {
    if (node.isRegularDirectory()) {
      // recursively delete directory content.
      let subNode = this.getFirst(node);
      while (subNode !== null) {
        this.deleteNode(subNode);
        subNode = this.getNext(subNode);
      }
    }
    if (node.isRegular()) {
      this.unlink(node);
      this.markNodeDeleted(node);
    }
  }

  /**
   * Release all clusters allocated to this node and mark all dir-entries as deleted.
   * @param {!FATNode} node
   */
  unlink(node) {
    let clusNum = node.getClusNum();
    while (this.isAllocated(clusNum)) {
      const nextClusNum = this.getNextClusNum(clusNum);
      this.setNextClusNum(clusNum, 0);
      clusNum = nextClusNum;
    }
  }

  /**
   * @param {!FATNode} node
   */
  markNodeDeleted(node) {
    let offset = node.offset;
    // mark all elements in the chain by setting 0xE5 to the first byte it is possible that the chain spans across multiple non-contiguous clusters
    for (let i = 0; i < node.dirs; i++) {
      if (offset === FAT_DRIVER_EOF) {
        // protect the code, however we shouldn't be here
        assert(false);
        break;
      }
      // offset is supposed to be 32-bytes aligned
      assert(offset % DIR_ENTRY_SIZE === 0);
      this.s.pos = offset;
      this.s.writeByte(DirEntryFlag.FREE_ENTRY);
      offset = this.getNextOffset(offset + DIR_ENTRY_SIZE);
    }
    node.kind = FATNodeKind.DELETED;
  }

  /**
   * @param {number} offset
   * @returns {?FATNode}
   */
  loadFromOffset(offset) {
    const chain = new FATChainLFN();
    let currentOffset = -1;
    while (1) {
      if (offset === FAT_DRIVER_EOF) {
        return null;
      }
      if (offset !== currentOffset) {
        assert(offset % DIR_ENTRY_SIZE === 0, "Offset " + offset + " is not " + DIR_ENTRY_SIZE + " bytes aligned");
        this.s.pos = offset;
        currentOffset = offset;
      }
      const flag = this.s.readByte();
      this.s.pos--;
      if (flag === DirEntryFlag.LAST_ENTRY) {
        return null;
      }
      const node = this.visitOffset(chain, currentOffset, flag);
      if (node !== null) {
        return node;
      }
      currentOffset += DIR_ENTRY_SIZE;
      offset = this.getNextOffset(currentOffset);
    }
  }

  /**
   * @param {!FATChainLFN} chain
   * @param {number} currentOffset
   * @param {number} flag
   * @returns {?FATNode}
   */
  visitOffset(chain, currentOffset, flag) {
    this.s.pos += 11;
    const attr = this.s.readByte();
    this.s.pos -= 12;
    if (flag === DirEntryFlag.FREE_ENTRY) {
      if (attr === DirEntryAttr.LONG_NAME) {
        chain.reset();
        this.s.pos += DIR_ENTRY_SIZE;
        return null;
      }
      const dir = loadDirEntry(this.s);
      return new FATNode(FATNodeKind.DELETED, getShortName(dir.Name, this.encoding), null, currentOffset, 1, dir);
    }
    if (attr === DirEntryAttr.LONG_NAME) {
      const dir = loadDirEntryLFN(this.s);
      chain.addDirEntryLFN(dir);
      return null;
    }
    const dir = loadDirEntry(this.s);
    if ((attr & DirEntryAttr.VOLUME_ID) !== 0) {
      return new FATNode(FATNodeKind.VOLUME_ID, getRawName(dir.Name, this.encoding), null, currentOffset, 1, dir);
    }
    if (dir.Name[0] === ".".charCodeAt(0)) {
      const dotName = getRawName(dir.Name, this.encoding);
      if (dotName === ".") {
        return new FATNode(FATNodeKind.CURRENT_DIR, ".", null, currentOffset, 1, dir);
      }
      if (dotName === "..") {
        return new FATNode(FATNodeKind.PARENT_DIR, "..", null, currentOffset, 1, dir);
      }
      chain.reset();
      return null;
    }
    if (!isNameValid(dir.Name)) {
      chain.reset();
      return null;
    }
    chain.addDirEntry(dir);
    const shortName = getShortName(dir.Name, this.encoding);
    const longName = chain.getLongName();
    if (shortName === "" || longName === "") {
      chain.reset();
      return null;
    }
    const type = (dir.Attr & DirEntryAttr.DIRECTORY) === 0 ? FATNodeKind.REGULAR_FILE : FATNodeKind.REGULAR_DIR;
    const chainLength = chain.size() * DIR_ENTRY_SIZE;
    return new FATNode(type, shortName, longName, currentOffset - chainLength, chain.size() + 1, dir);
  }

  /**
   * @param {number} offset
   * @returns {number}
   */
  getNextOffset(offset) {
    assert(offset % DIR_ENTRY_SIZE === 0);
    // if the offset points to the first byte of the cluster, treat it as 'overflow'
    // in this case, retrieve the next cluster from the first FAT table
    // note: There is an exception for the root directory, which has a flat structure
    if (offset % this.bs.bpb.BytsPerSec !== 0) {
      // the offset is within the sector: no overflow
      return offset;
    }
    const secNum = offset / this.bs.bpb.BytsPerSec;
    assert(Number.isInteger(secNum));
    if (secNum < this.vars.FirstDataSector) {
      // the offset is within the root directory: no further FAT table lookups are necessary
      return offset;
    }
    if (secNum === this.vars.FirstDataSector) {
      // we have reached the end of the root directory: EOF
      return FAT_DRIVER_EOF;
    }
    const dataSecNum = secNum - this.vars.FirstDataSector;
    if (dataSecNum % this.bs.bpb.SecPerClus !== 0) {
      // the offset doesn't point to the first byte of the cluster: no overflow
      return offset;
    }
    // [0 1 2 ...
    // [2 3 4 ...
    //      ^
    //      overflow at N=2, N+1 is the cluster number before overflow
    const clusNum = 1 + dataSecNum / this.bs.bpb.SecPerClus;
    assert(Number.isInteger(clusNum));
    const nexClusNum = this.getNextClusNum(clusNum);
    return this.getContentOffset(nexClusNum);
  }

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getContentOffset(clusNum) {
    if (this.isAllocated(clusNum)) {
      return this.bs.bpb.BytsPerSec * this.getFirstSectorOfCluster(clusNum);
    }
    return FAT_DRIVER_EOF;
  }

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getFirstSectorOfCluster(clusNum) {
    return this.vars.FirstDataSector + (clusNum - 2) * this.bs.bpb.SecPerClus;
  }

  /**
   * @param {number} clusNum
   * @returns {boolean}
   */
  isAllocated(clusNum) {
    return clusNum >= 2 && clusNum <= this.vars.MaxClus;
  }

  /**
   * @returns {string}
   */
  getVolumName() {
    let node = this.getFirst(this.getRoot());
    while (node !== null && node.kind !== FATNodeKind.VOLUME_ID) {
      node = this.getNext(node);
    }
    return node === null ? getRawName(this.bs.VolLab, this.encoding) : node.getName();
  }

  /**
   * @returns {number}
   */
  getCountOfFreeClusters() {
    let count = 0;
    for (let i = MIN_CLUS_NUM; i <= this.vars.MaxClus; i++) {
      if (this.getNextClusNum(i) === FREE_CLUS) {
        count++;
      }
    }
    return count;
  }

  // FAT12

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getFATClusPos12(clusNum) {
    assert(this.isAllocated(clusNum));
    const offset = clusNum + Math.floor(clusNum / 2);
    return this.bs.bpb.RsvdSecCnt * this.bs.bpb.BytsPerSec + offset;
  }

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getNextClusNum12(clusNum) {
    this.s.pos = this.getFATClusPos12(clusNum);
    const val = this.s.readWord();
    return clusNum & 1 ? val >> 4 : val & 0x0fff;
  }

  /**
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum12(clusNum, value) {
    assert(value >= 0 && value <= 0xfff);
    this.s.pos = this.getFATClusPos12(clusNum);
    const val = this.s.readWord();
    this.s.pos -= 2;
    this.s.writeWord(clusNum & 1 ? (value << 4) | (val & 0xf) : (val & 0xf000) | value);
  }

  // FAT16

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getFATClusPos16(clusNum) {
    const offset = clusNum * 2;
    return this.bs.bpb.RsvdSecCnt * this.bs.bpb.BytsPerSec + offset;
  }

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getNextClusNum16(clusNum) {
    this.s.pos = this.getFATClusPos16(clusNum);
    return this.s.readWord();
  }

  /**
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum16(clusNum, value) {
    assert(value >= 0 && value <= 0xffff);
    this.s.pos = this.getFATClusPos16(clusNum);
    this.s.writeWord(value);
  }

  // FAT32

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getFATClusPos32(clusNum) {
    const offset = clusNum * 4;
    return this.bs.bpb.RsvdSecCnt * this.bs.bpb.BytsPerSec + offset;
  }

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getNextClusNum32(clusNum) {
    this.s.pos = this.getFATClusPos32(clusNum);
    return this.s.readDoubleWord() & 0x0fffffff;
  }

  /**
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum32(clusNum, value) {
    assert(value >= 0 && value <= 0x0fffffff);
    this.s.pos = this.getFATClusPos32(clusNum);
    const val = this.s.readDoubleWord();
    this.s.pos -= 4;
    this.s.writeDoubleWord((val & 0xf0000000) | value);
  }
}

/**
 * @param {!BiosParameterBlock} bpb
 */
function validateBiosParameterBlock(bpb) {
  validate([512, 1024, 2048, 4096].includes(bpb.BytsPerSec));
  validate([1, 2, 4, 8, 16, 32, 64, 128].includes(bpb.SecPerClus));
  validate(bpb.RsvdSecCnt > 0);
  validate(bpb.NumFATs > 0);
  validate((bpb.RootEntCnt * 32) % bpb.BytsPerSec === 0);
  validate([0xf0, 0xf8, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff].includes(bpb.Media));
  validate(bpb.RootEntCnt === 0 || bpb.FATSz16 > 0);
  validate(bpb.TotSec16 === 0 ? bpb.TotSec32 >= 0x10000 : bpb.TotSec32 === 0);
}

/**
 * @param {?BiosParameterBlockFAT32} bpbFAT32
 */
function validateBiosParameterBlockFAT32(bpbFAT32) {
  validate(bpbFAT32 !== null);
  validate(bpbFAT32.FSVer === 0);
  validate(bpbFAT32.RootClus >= 2);
  validate(bpbFAT32.BkBootSec === 0 || bpbFAT32.BkBootSec === 6);
}
