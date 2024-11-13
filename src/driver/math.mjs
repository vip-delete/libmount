import { BiosParameterBlock, Device, FATMath, FATVariables, FSInfo } from "../types.mjs";
import { assert } from "../support.mjs";
import { loadAndValidateFSInfo } from "../loaders.mjs";

export const DIR_ENTRY_SIZE = 32;
const MIN_CLUS_NUM = 2;
const FREE_CLUS = 0;

/**
 * @abstract
 * @implements {FATMath}
 */
class FATMathBase {
  /**
   * @param {!Device} device
   * @param {!BiosParameterBlock} bpb
   * @param {!FATVariables} vars
   */
  constructor(device, bpb, vars) {
    /**
     * @private
     * @constant
     */
    this.device = device;
    /**
     * @private
     * @constant
     */
    this.bpb = bpb;
    /**
     * @private
     * @constant
     */
    this.vars = vars;
  }

  /**
   * @override
   * @returns {number}
   */
  getClusterSize() {
    return this.vars.SizeOfCluster;
  }

  /**
   * @override
   * @returns {number}
   */
  getRootDirOffset() {
    return this.vars.RootDirOffset;
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {?number}
   */
  getContentOffset(clusNum) {
    return this.isAllocated(clusNum) ? this.bpb.BytsPerSec * (this.vars.FirstDataSector + (clusNum - 2) * this.bpb.SecPerClus) : null;
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {boolean}
   */
  isAllocated(clusNum) {
    return clusNum >= MIN_CLUS_NUM && clusNum <= this.vars.MaxClus;
  }

  /**
   * @override
   * @param {number} clusNum
   */
  writeZeros(clusNum) {
    const off = this.getContentOffset(clusNum);
    if (off !== null) {
      this.device.seek(off);
      this.device.writeArray(new Uint8Array(this.vars.SizeOfCluster));
    }
  }

  /**
   * @override
   * @returns {number}
   */
  getFreeClusters() {
    let count = 0;
    for (let i = MIN_CLUS_NUM; i <= this.vars.MaxClus; i++) {
      if (this.getNextClusNum(i) === FREE_CLUS) {
        count++;
      }
    }
    return count;
  }

  /**
   * @override
   * @param {number} count
   * @returns {?Array<number>}
   */
  allocateClusters(count) {
    assert(Number.isInteger(count));
    assert(count > 0);
    /**
     * @type {!Array<number>}
     */
    const list = [];
    let i = MIN_CLUS_NUM;
    while (i <= this.vars.MaxClus && list.length < count) {
      if (this.getNextClusNum(i) === FREE_CLUS) {
        list.push(i);
      }
      i++;
    }
    if (list.length < count) {
      // no space
      return null;
    }
    // connect all allocated clusters into a chain
    for (let j = 0; j < list.length - 1; j++) {
      this.setNextClusNum(list[j], list[j + 1]);
    }
    this.setNextClusNum(list.at(-1), this.getFinalClus());
    return list;
  }

  /**
   * @override
   * @param {number} offset
   * @returns {?number}
   */
  getNextDirEntryOffset(offset) {
    assert(offset > 0 && offset % DIR_ENTRY_SIZE === 0);
    // if the offset points to the first byte of the cluster, treat it as 'overflow'
    // in this case, retrieve the next cluster from the first FAT table
    // note: There is an exception for the root directory, which has a flat structure for FAT12 and FAT16
    if (offset % this.bpb.BytsPerSec !== 0) {
      // the offset is within the sector: no overflow
      return offset;
    }
    const secNum = offset / this.bpb.BytsPerSec;
    assert(Number.isInteger(secNum));
    if (secNum < this.vars.FirstDataSector) {
      // the offset is within the root directory on FAT12 or FAT16: no further FAT table lookups are necessary
      return offset;
    }
    if (secNum === this.vars.FirstDataSector) {
      // we have reached the end of the root directory: EOF
      return null;
    }
    const dataSecNum = secNum - this.vars.FirstDataSector;
    if (dataSecNum % this.bpb.SecPerClus !== 0) {
      // the offset doesn't point to the first byte of the cluster: no overflow
      return offset;
    }
    // [0 1 2 ...
    // [2 3 4 ...
    //      ^
    //      overflow at N=2, N+1 is the cluster number before overflow
    const clusNum = 1 + dataSecNum / this.bpb.SecPerClus;
    assert(Number.isInteger(clusNum));
    const nexClusNum = this.getNextClusNum(clusNum);
    return this.getContentOffset(nexClusNum);
  }

  /**
   * @override
   * @param {number} offset
   * @returns {?number}
   */
  getClusNum(offset) {
    assert(offset >= 0);
    assert(Number.isInteger(offset));
    const secNum = Math.floor(offset / this.bpb.BytsPerSec);
    if (secNum < this.vars.FirstDataSector) {
      // the offset is within the root directory on FAT12 or FAT16: there is no clusNum
      return null;
    }
    const dataSecNum = secNum - this.vars.FirstDataSector;
    const clusNum = MIN_CLUS_NUM + Math.floor(dataSecNum / this.bpb.SecPerClus);
    return clusNum;
  }
}

/**
 * @implements {FATMath}
 */
class FAT12Math extends FATMathBase {
  /**
   * @override
   * @returns {string}
   */
  getFileSystemName() {
    return "FAT12";
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {number}
   */
  getNextClusNum(clusNum) {
    this.device.seek(this.getFATClusPos(clusNum));
    const val = this.device.readWord();
    return clusNum & 1 ? val >> 4 : val & 0x0fff;
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum(clusNum, value) {
    assert(value >= 0 && value <= 0xfff);
    this.device.seek(this.getFATClusPos(clusNum));
    const val = this.device.readWord();
    this.device.skip(-2);
    this.device.writeWord(clusNum & 1 ? (value << 4) | (val & 0xf) : (val & 0xf000) | value);
  }

  /**
   * @override
   * @returns {number}
   */
  getFinalClus() {
    return 0xfff;
  }

  /**
   * @private
   * @param {number} clusNum
   * @returns {number}
   */
  getFATClusPos(clusNum) {
    assert(this.isAllocated(clusNum));
    const offset = clusNum + Math.floor(clusNum / 2);
    return this.bpb.RsvdSecCnt * this.bpb.BytsPerSec + offset;
  }
}

/**
 * @implements {FATMath}
 */
class FAT16Math extends FATMathBase {
  /**
   * @override
   * @returns {string}
   */
  getFileSystemName() {
    return "FAT16";
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {number}
   */
  getNextClusNum(clusNum) {
    this.device.seek(this.getFATClusPos(clusNum));
    return this.device.readWord();
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum(clusNum, value) {
    assert(value >= 0 && value <= 0xffff);
    this.device.seek(this.getFATClusPos(clusNum));
    this.device.writeWord(value);
  }

  /**
   * @override
   * @returns {number}
   */
  getFinalClus() {
    return 0xffff;
  }

  /**
   * @private
   * @param {number} clusNum
   * @returns {number}
   */
  getFATClusPos(clusNum) {
    assert(this.isAllocated(clusNum));
    const offset = clusNum * 2;
    return this.bpb.RsvdSecCnt * this.bpb.BytsPerSec + offset;
  }
}

/**
 * @implements {FATMath}
 */
class FAT32Math extends FATMathBase {
  /**
   * @param {!Device} device
   * @param {!BiosParameterBlock} bpb
   * @param {!FATVariables} vars
   * @param {!FSInfo} fsi
   */
  constructor(device, bpb, vars, fsi) {
    super(device, bpb, vars);
    /**
    //  * @private
     * @constant
     */
    this.fsi = fsi;
  }

  /**
   * @override
   * @returns {string}
   */
  getFileSystemName() {
    return "FAT32";
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {number}
   */
  getNextClusNum(clusNum) {
    this.device.seek(this.getFATClusPos(clusNum));
    return this.device.readDoubleWord() & 0x0fffffff;
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum(clusNum, value) {
    assert(value >= 0 && value <= 0x0fffffff);
    this.device.seek(this.getFATClusPos(clusNum));
    const val = this.device.readDoubleWord();
    this.device.skip(-4);
    this.device.writeDoubleWord((val & 0xf0000000) | value);
  }

  /**
   * @override
   * @returns {number}
   */
  getFinalClus() {
    return 0x0fffffff;
  }

  /**
   * @private
   * @param {number} clusNum
   * @returns {number}
   */
  getFATClusPos(clusNum) {
    assert(this.isAllocated(clusNum));
    const offset = clusNum * 4;
    return this.bpb.RsvdSecCnt * this.bpb.BytsPerSec + offset;
  }
}

/**
 * @param {!Device} device
 * @param {!BiosParameterBlock} bpb
 * @param {!FATVariables} vars
 * @returns {!FATMath}
 */
export function createFATMath(device, bpb, vars) {
  if (vars.CountOfClusters < 4085) {
    // A FAT12 volume cannot contain more than 4084 clusters.
    return new FAT12Math(device, bpb, vars);
  }
  if (vars.CountOfClusters < 65525) {
    // A FAT16 volume cannot contain less than 4085 clusters or more than 65,524 clusters.
    return new FAT16Math(device, bpb, vars);
  }
  device.seek(bpb.BytsPerSec);
  const fsi = loadAndValidateFSInfo(device);
  return new FAT32Math(device, bpb, vars, fsi);
}
