import { BootSector, DirEntry, DirEntryLN, FATDriver, FATNode, FATVariables, FAT_NODE } from "./model.mjs";
import { BlockDevice } from "./io.mjs";
import { NameUtil } from "./util.mjs";
import { assert } from "./support.mjs";

const DIR_LN_LAST_LONG_ENTRY = 0x40;

class FATChainLN {
  constructor() {
    /**
     * @type {!Array<!DirEntryLN>}
     */
    this.list = [];
  }

  /**
   * @param {!DirEntryLN} dir
   */
  addDirLN(dir) {
    const last = (dir.Ord & DIR_LN_LAST_LONG_ENTRY) !== 0;
    if (last) {
      this.list = [dir];
      return;
    }
    if (this.list.length === 0) {
      return;
    }
    const prev = this.list[this.list.length - 1].Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
    const curr = dir.Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
    if (prev === curr + 1) {
      this.list.push(dir);
      return;
    }
    this.clear();
  }

  /**
   * @param {!DirEntry} dir
   */
  addDir(dir) {
    if (this.list.length === 0) {
      return;
    }
    const k = this.list.length - 1;
    const ord = this.list[k].Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
    if (ord !== 1 || this.list[k].Chksum !== NameUtil.getChkSum(dir.Name)) {
      this.clear();
    }
  }

  /**
   * @returns {undefined}
   */
  clear() {
    this.list.length = 0;
  }

  /**
   * @returns {number}
   */
  size() {
    return this.list.length;
  }

  /**
   * @returns {?string}
   */
  getLongName() {
    if (this.list.length === 0) {
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
const DIR_FLAG = {
  LAST_ENTRY: 0x00,
  FREE_ENTRY: 0xe5,
};

/**
 * @enum
 */
const DIR_ATTR = {
  READ_ONLY: 0x01,
  HIDDEN: 0x02,
  SYSTEM: 0x04,
  VOLUME_ID: 0x08,
  DIRECTORY: 0x10,
  ARCHIVE: 0x20,
  LONG_NAME: 0xf, // READ_ONLY | HIDDEN | SYSTEM | VOLUME_ID
};

const FAT_DRIVER_EOF = 0;
const DIR_ENTRY_SIZE = 32;

/**
 * @implements {FATDriver}
 */
export class FAT12Driver {
  /**
   * @param {!BlockDevice} s
   * @param {!BootSector} bs
   * @param {!FATVariables} vars
   * @param {string} encoding
   */
  constructor(s, bs, vars, encoding) {
    this.s = s;
    this.bs = bs;
    this.vars = vars;
    this.encoding = encoding;
  }

  /**
   * @override
   * @returns {!LibMount.VolumeInfo}
   */
  getVolumeInfo() {
    let node = this.getFirst(this.getRoot());
    while (node !== null && node.type !== FAT_NODE.VOLUME_ID) {
      node = this.getNext(node);
    }
    const type = "FAT12";
    const label = node === null ? NameUtil.getRawName(this.bs.VolLab, this.encoding) : node.getName();
    const id = this.bs.VolID;
    const clusterSize = this.bs.bpb.BytsPerSec * this.bs.bpb.SecPerClus;
    let freeSpace = 0;
    for (let i = 2; i <= this.vars.MAX; i++) {
      const val = this.getNextClusNum(i);
      if (val === 0) {
        freeSpace += clusterSize;
      }
    }
    return {
      type,
      label,
      id,
      clusterSize,
      freeSpace,
    };
  }

  /**
   * @override
   * @returns {!FATNode}
   */
  getRoot() {
    return new FATNode(FAT_NODE.ROOT, "", null, FAT_DRIVER_EOF, 0, null);
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getNext(node) {
    return node.type === FAT_NODE.ROOT ? null : this.loadFromOffset(this.getNextOffset(node.offset + node.dirSize * DIR_ENTRY_SIZE));
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getFirst(node) {
    if (node.type === FAT_NODE.ROOT) {
      return this.loadFromOffset(this.bs.bpb.BytsPerSec * this.vars.FirstRootDirSecNum);
    }
    if (node.type !== FAT_NODE.REGULAR_DIR) {
      return null;
    }
    return this.loadFromOffset(this.getContentOffset(node.getClusNum()));
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?Uint8Array}
   */
  readNode(node) {
    if (node.type !== FAT_NODE.REGULAR_FILE) {
      return null;
    }
    const fileSize = node.getFileSize();
    let clusNum = node.getClusNum();
    let size = 0;
    const arr = new Uint8Array(new ArrayBuffer(fileSize));
    const BytsPerClus = this.bs.bpb.BytsPerSec * this.bs.bpb.SecPerClus;
    while (size < fileSize) {
      const offset = this.getContentOffset(clusNum);
      if (offset === FAT_DRIVER_EOF) {
        break;
      }
      const len = Math.min(BytsPerClus, fileSize - size);
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
   */
  deleteNode(node) {
    if (node.type === FAT_NODE.REGULAR_FILE) {
      let clusNum = node.getClusNum();
      while (this.isAllocated(clusNum)) {
        const nextClusNum = this.getNextClusNum(clusNum);
        this.setNextClusNum(clusNum, 0);
        clusNum = nextClusNum;
      }
      this.markNodeDeleted(node);
    }
    if (node.type === FAT_NODE.REGULAR_DIR) {
      let subNode = this.getFirst(node);
      while (subNode !== null) {
        this.deleteNode(subNode);
        subNode = this.getNext(subNode);
      }
      this.markNodeDeleted(node);
    }
  }

  /**
   * @param {!FATNode} node
   */
  markNodeDeleted(node) {
    this.s.pos = node.offset;
    for (let i = 0; i < node.dirSize; i++) {
      this.s.pos = node.offset + i * DIR_ENTRY_SIZE;
      this.s.writeByte(DIR_FLAG.FREE_ENTRY);
    }
    node.type = FAT_NODE.DELETED;
  }

  /**
   * @param {number} offset
   * @returns {?FATNode}
   */
  loadFromOffset(offset) {
    const chain = new FATChainLN();
    let currentOffset = -1;
    while (true) {
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
      if (flag === DIR_FLAG.LAST_ENTRY) {
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
   * @param {!FATChainLN} chain
   * @param {number} currentOffset
   * @param {number} flag
   * @returns {?FATNode}
   */
  visitOffset(chain, currentOffset, flag) {
    this.s.pos += 11;
    const attr = this.s.readByte();
    this.s.pos -= 12;
    if (flag === DIR_FLAG.FREE_ENTRY) {
      if (attr === DIR_ATTR.LONG_NAME) {
        chain.clear();
        this.s.pos += DIR_ENTRY_SIZE;
        return null;
      }
      const dir = DirEntry.load(this.s);
      return new FATNode(FAT_NODE.DELETED, NameUtil.getShortName(dir.Name, this.encoding), null, currentOffset, 1, dir);
    }
    if (attr === DIR_ATTR.LONG_NAME) {
      const dir = DirEntryLN.load(this.s);
      chain.addDirLN(dir);
      return null;
    }
    const dir = DirEntry.load(this.s);
    if ((attr & DIR_ATTR.VOLUME_ID) !== 0) {
      return new FATNode(FAT_NODE.VOLUME_ID, NameUtil.getRawName(dir.Name, this.encoding), null, currentOffset, 1, dir);
    }
    if (dir.Name[0] === ".".charCodeAt(0)) {
      const dotName = NameUtil.getRawName(dir.Name, this.encoding);
      if (dotName === ".") {
        return new FATNode(FAT_NODE.CURRENT_DIR, ".", null, currentOffset, 1, dir);
      }
      if (dotName === "..") {
        return new FATNode(FAT_NODE.PARENT_DIR, "..", null, currentOffset, 1, dir);
      }
      chain.clear();
      return null;
    }
    if (!NameUtil.isNameValid(dir.Name)) {
      chain.clear();
      return null;
    }
    chain.addDir(dir);
    const shortName = NameUtil.getShortName(dir.Name, this.encoding);
    const longName = chain.getLongName();
    if (shortName === "" || longName === "") {
      chain.clear();
      return null;
    }
    const type = (dir.Attr & DIR_ATTR.DIRECTORY) !== 0 ? FAT_NODE.REGULAR_DIR : FAT_NODE.REGULAR_FILE;
    const chainLength = chain.size() * DIR_ENTRY_SIZE;
    return new FATNode(type, shortName, longName, currentOffset - chainLength, chain.size() + 1, dir);
  }

  /**
   * @param {number} offset
   * @returns {number}
   */
  getNextOffset(offset) {
    if (offset % this.bs.bpb.BytsPerSec !== 0) {
      return offset;
    }
    const secNum = Math.floor(offset / this.bs.bpb.BytsPerSec);
    if (secNum < this.vars.FirstDataSector) {
      return offset;
    }
    if (secNum === this.vars.FirstDataSector) {
      return FAT_DRIVER_EOF;
    }
    const dataSecNum = secNum - this.vars.FirstDataSector;
    if (dataSecNum % this.bs.bpb.SecPerClus !== 0) {
      return offset;
    }
    const nexClusNum = this.getNextClusNum(1 + Math.floor(dataSecNum / this.bs.bpb.SecPerClus));
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
   * @returns {number}
   */
  getFATClusPos(clusNum) {
    assert(this.isAllocated(clusNum));
    const fatOffset = clusNum + Math.floor(clusNum / 2);
    const thisFATSecNum = this.bs.bpb.RsvdSecCnt + Math.floor(fatOffset / this.bs.bpb.BytsPerSec);
    const thisFATEntOffset = fatOffset % this.bs.bpb.BytsPerSec;
    return thisFATSecNum * this.bs.bpb.BytsPerSec + thisFATEntOffset;
  }

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getNextClusNum(clusNum) {
    this.s.pos = this.getFATClusPos(clusNum);
    const fat12ClusEntryVal = this.s.readWord();
    return (clusNum & 1) === 1 ? fat12ClusEntryVal >> 4 : fat12ClusEntryVal & 0x0fff;
  }

  /**
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum(clusNum, value) {
    assert(0 <= value && value <= 0xfff);
    this.s.pos = this.getFATClusPos(clusNum);
    const fat12ClusEntryVal = this.s.readWord();
    this.s.pos -= 2;
    this.s.writeWord((clusNum & 1) === 1 ? (value << 4) | (fat12ClusEntryVal & 0xf) : (fat12ClusEntryVal & 0xf000) | value);
  }

  /**
   * @param {number} clusNum
   * @returns {boolean}
   */
  isAllocated(clusNum) {
    return 2 <= clusNum && clusNum <= this.vars.MAX;
  }
}
