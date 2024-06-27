import { Device, DirEntry, DirEntryLFN, FATNode, FATNodeType, FileSystemDriver } from "./types.mjs";
import { decode, getChkSum, getShortName, isShortNameValid } from "./util.mjs";
import { loadAndValidateBootSector, loadAndValidateFSInfo, loadDirEntry, loadDirEntryLFN, loadFATVariables } from "./loaders.mjs";
import { assert } from "./support.mjs";

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
      // skip invalid LFN: previous LFN is not first or checksum doesn't match
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
    // LFN has ended without NULL-terminator
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

const ROOT_NODE = {
  Type: FATNodeType.ROOT,
  Name: "",
  ShortName: "",
  FirstDirOffset: FAT_DRIVER_EOF,
  DirCount: 0,
  DirEntry: {
    Name: new Uint8Array(0),
    Attr: 0,
    NTRes: 0,
    CrtTimeTenth: 0,
    CrtTime: 0,
    CrtDate: 0,
    LstAccDate: 0,
    FstClusHI: 0,
    WrtTime: 0,
    WrtDate: 0,
    FstClusLO: 0,
    FileSize: 0,
  },
};

/**
 * @implements {FileSystemDriver<!FATNode>}
 */
export class FATDriver {
  /**
   * @param {!Device} device
   * @param {string} charmap
   */
  constructor(device, charmap) {
    this.device = device;
    this.charmap = charmap;
    device.seek(0);
    this.bs = loadAndValidateBootSector(device);
    this.vars = loadFATVariables(this.bs);
    if (this.vars.CountOfClusters < 4085) {
      // A FAT12 volume cannot contain more than 4084 clusters.
      this.fsi = null;
      this.fileSystemName = "FAT12";
      this.getNextClusNum = this.getNextClusNum12;
      this.setNextClusNum = this.setNextClusNum12;
    } else if (this.vars.CountOfClusters < 65525) {
      // A FAT16 volume cannot contain less than 4085 clusters or more than 65,524 clusters.
      this.fsi = null;
      this.fileSystemName = "FAT16";
      this.getNextClusNum = this.getNextClusNum16;
      this.setNextClusNum = this.setNextClusNum16;
    } else {
      this.device.seek(this.bs.bpb.BytsPerSec);
      this.fsi = loadAndValidateFSInfo(device);
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
      OEMName: decode(this.bs.OEMName, this.charmap),
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
    return ROOT_NODE;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getNext(node) {
    return node.Type === FATNodeType.ROOT ? null : this.loadFromOffset(this.getNextOffset(node.FirstDirOffset + node.DirCount * DIR_ENTRY_SIZE));
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getFirst(node) {
    if (node.Type === FATNodeType.ROOT) {
      return this.loadFromOffset(this.vars.RootDirOffset);
    }
    if (node.Type === FATNodeType.REGULAR_DIR) {
      return this.loadFromOffset(this.getContentOffset(getClusNum(node)));
    }
    // protect the code: node is not a directory?
    return null;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?Uint8Array}
   */
  readNode(node) {
    if (node.Type !== FATNodeType.REGULAR_FILE) {
      return null;
    }
    const fileSize = node.DirEntry.FileSize;
    let clusNum = getClusNum(node);
    let size = 0;
    const arr = new Uint8Array(new ArrayBuffer(fileSize));
    while (size < fileSize) {
      const offset = this.getContentOffset(clusNum);
      if (offset === FAT_DRIVER_EOF) {
        // protect the code: wrong FileSize?
        break;
      }
      const len = Math.min(this.vars.SizeOfCluster, fileSize - size);
      this.device.seek(offset);
      const chunk = this.device.readArray(len);
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
    if (node.Type === FATNodeType.REGULAR_DIR) {
      // recursively delete directory content.
      let subNode = this.getFirst(node);
      while (subNode !== null) {
        this.deleteNode(subNode);
        subNode = this.getNext(subNode);
      }
    }
    if (node.Type === FATNodeType.REGULAR_DIR || node.Type === FATNodeType.REGULAR_FILE) {
      this.unlink(node);
      this.markNodeDeleted(node);
    }
  }

  /**
   * Release all clusters allocated to this node and mark all dir-entries as deleted.
   * @param {!FATNode} node
   */
  unlink(node) {
    let clusNum = getClusNum(node);
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
    let offset = node.FirstDirOffset;
    // mark all elements in the chain by setting 0xE5 to the first byte
    // it is possible that the chain spans across multiple non-contiguous clusters
    for (let i = 0; i < node.DirCount; i++) {
      if (offset === FAT_DRIVER_EOF) {
        // protect the code: wrong number of dirs?
        break;
      }
      // offset is supposed to be 32-bytes aligned
      assert(offset % DIR_ENTRY_SIZE === 0);
      this.device.seek(offset);
      this.device.writeByte(DirEntryFlag.FREE_ENTRY);
      offset = this.getNextOffset(offset + DIR_ENTRY_SIZE);
    }
    node.Type = FATNodeType.DELETED;
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
        this.device.seek(offset);
        currentOffset = offset;
      }
      const flag = this.device.readByte();
      this.device.skip(-1);
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
    this.device.skip(11);
    const attr = this.device.readByte();
    this.device.skip(-12);
    if (flag === DirEntryFlag.FREE_ENTRY) {
      if (attr === DirEntryAttr.LONG_NAME) {
        chain.reset();
        this.device.skip(DIR_ENTRY_SIZE);
        return null;
      }
      const dir = loadDirEntry(this.device);
      const name = getShortName(dir.Name, this.charmap);
      return {
        Type: FATNodeType.DELETED,
        Name: name,
        ShortName: name,
        FirstDirOffset: currentOffset,
        DirCount: 1,
        DirEntry: dir,
      };
    }
    if (attr === DirEntryAttr.LONG_NAME) {
      const dir = loadDirEntryLFN(this.device);
      chain.addDirEntryLFN(dir);
      return null;
    }
    const dir = loadDirEntry(this.device);
    if ((attr & DirEntryAttr.VOLUME_ID) !== 0) {
      const label = decode(dir.Name, this.charmap);
      return {
        Type: FATNodeType.VOLUME_ID,
        Name: label,
        ShortName: label,
        FirstDirOffset: currentOffset,
        DirCount: 1,
        DirEntry: dir,
      };
    }
    if (dir.Name[0] === ".".charCodeAt(0)) {
      const dotName = decode(dir.Name, this.charmap);
      if (dotName === ".") {
        return {
          Type: FATNodeType.CURRENT_DIR,
          Name: dotName,
          ShortName: dotName,
          FirstDirOffset: currentOffset,
          DirCount: 1,
          DirEntry: dir,
        };
      }
      if (dotName === "..") {
        return {
          Type: FATNodeType.PARENT_DIR,
          Name: dotName,
          ShortName: dotName,
          FirstDirOffset: currentOffset,
          DirCount: 1,
          DirEntry: dir,
        };
      }
      // protect the code: wrong 'dot' entry?
      chain.reset();
      return null;
    }
    if (!isShortNameValid(dir.Name)) {
      // protect the code: wrong name?
      chain.reset();
      return null;
    }
    chain.addDirEntry(dir);
    const shortName = getShortName(dir.Name, this.charmap);
    const longName = chain.getLongName();
    if (shortName === "" || longName === "") {
      // protect the code: wrong name?
      chain.reset();
      return null;
    }
    const kind = (dir.Attr & DirEntryAttr.DIRECTORY) === 0 ? FATNodeType.REGULAR_FILE : FATNodeType.REGULAR_DIR;
    const name = longName ?? shortName;
    const firstDirOffset = currentOffset - chain.size() * DIR_ENTRY_SIZE;
    const dirCount = chain.size() + 1;
    return {
      Type: kind,
      Name: name,
      ShortName: shortName,
      FirstDirOffset: firstDirOffset,
      DirCount: dirCount,
      DirEntry: dir,
    };
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
    while (node !== null && node.Type !== FATNodeType.VOLUME_ID) {
      node = this.getNext(node);
    }
    return node === null ? decode(this.bs.VolLab, this.charmap) : node.Name;
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
    this.device.seek(this.getFATClusPos12(clusNum));
    const val = this.device.readWord();
    return clusNum & 1 ? val >> 4 : val & 0x0fff;
  }

  /**
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum12(clusNum, value) {
    assert(value >= 0 && value <= 0xfff);
    this.device.seek(this.getFATClusPos12(clusNum));
    const val = this.device.readWord();
    this.device.skip(-2);
    this.device.writeWord(clusNum & 1 ? (value << 4) | (val & 0xf) : (val & 0xf000) | value);
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
    this.device.seek(this.getFATClusPos16(clusNum));
    return this.device.readWord();
  }

  /**
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum16(clusNum, value) {
    assert(value >= 0 && value <= 0xffff);
    this.device.seek(this.getFATClusPos16(clusNum));
    this.device.writeWord(value);
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
    this.device.seek(this.getFATClusPos32(clusNum));
    return this.device.readDoubleWord() & 0x0fffffff;
  }

  /**
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum32(clusNum, value) {
    assert(value >= 0 && value <= 0x0fffffff);
    this.device.seek(this.getFATClusPos32(clusNum));
    const val = this.device.readDoubleWord();
    this.device.skip(-4);
    this.device.writeDoubleWord((val & 0xf0000000) | value);
  }
}

/**
 * @param {!FATNode} node
 * @returns {number}
 */
function getClusNum(node) {
  return (node.DirEntry.FstClusHI << 16) | node.DirEntry.FstClusLO;
}
