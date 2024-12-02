// @ts-nocheck
import { assert, impossibleNull } from "./support.mjs";
import { BiosParameterBlock, DIR_ENTRY_SIZE, Device, FATMath, FATVariables, FSInfo } from "./types.mjs";

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
   * @param {number} finalClus
   * @param {number} multiplier
   */
  constructor(device, bpb, vars, finalClus, multiplier) {
    /**
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

    /**
     * @type {!Array<number>}
     */
    const offsetFATs = new Array(bpb.NumFATs);
    for (let i = 0; i < bpb.NumFATs; i++) {
      offsetFATs[i] = (bpb.RsvdSecCnt + i * vars.FATSz) * bpb.BytsPerSec;
    }

    /**
     * @private
     * @constant
     */
    this.offsetFATs = offsetFATs;

    /**
     * @constant
     */
    this.finalClus = finalClus;

    /**
     * @private
     * @constant
     */
    this.multiplier = multiplier;
  }

  // Abstract Methods

  /* eslint-disable no-unused-vars, no-empty-function */

  /**
   * @abstract
   * @param {number} clusNum
   * @returns {number}
   */
  readNextClusNum(clusNum) {}

  /**
   * @abstract
   * @param {number} clusNum
   * @param {number} value
   */
  writeNextClusNum(clusNum, value) {}

  /* eslint-enable no-unused-vars, no-empty-function */

  // FATMath

  /**
   * @override
   * @returns {number}
   */
  // @ts-ignore
  getRootDirOffset() {
    return this.vars.RootDirOffset;
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {?number}
   */
  // @ts-ignore
  getContentOffset(clusNum) {
    return this.isAllocated(clusNum) ? this.bpb.BytsPerSec * (this.vars.FirstDataSector + (clusNum - 2) * this.bpb.SecPerClus) : null;
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {boolean}
   */
  // @ts-ignore
  isAllocated(clusNum) {
    assert(Number.isInteger(clusNum));
    return clusNum >= MIN_CLUS_NUM && clusNum <= this.vars.MaxClus;
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {number}
   */
  // @ts-ignore
  getNextClusNum(clusNum) {
    const clusOffset = this.getClusOffset(clusNum);
    this.device.seek(this.offsetFATs[0] + clusOffset);
    const next = this.readNextClusNum(clusNum);
    return next;
    // let ret = -1;
    // for (let i = 0; i < this.offsetFATs.length; i++) {
    //   this.device.seek(this.offsetFATs[i] + clusOffset);
    //   const nextClus = this.readNextClusNum(clusNum);
    //   if (ret < 0) {
    //     ret = nextClus;
    //   } else if (ret !== nextClus) {
    //     log.warn(`getNextClusNum: FAT is different for clusNum = ${clusNum}`);
    //   }
    // }
    // return ret;
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  // @ts-ignore
  setNextClusNum(clusNum, value) {
    const clusOffset = this.getClusOffset(clusNum);
    for (let i = 0; i < this.offsetFATs.length; i++) {
      const offset = this.offsetFATs[i] + clusOffset;
      this.device.seek(offset);
      this.writeNextClusNum(clusNum, value);
    }
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {null}
   */
  // @ts-ignore
  writeZeros(clusNum) {
    const offset = this.getContentOffset(clusNum);
    if (offset === null) {
      return impossibleNull();
    }
    this.device.seek(offset);
    this.device.writeArray(new Uint8Array(this.vars.SizeOfCluster));
    return null;
  }

  /**
   * @override
   * @param {number} clusNum
   */
  // @ts-ignore
  setFreeClusNum(clusNum) {
    this.setNextClusNum(clusNum, FREE_CLUS);
  }

  /**
   * @override
   * @param {number} clusNum
   */
  // @ts-ignore
  setFinalClusNum(clusNum) {
    this.setNextClusNum(clusNum, this.finalClus);
  }

  /**
   * @override
   * @returns {number}
   */
  // @ts-ignore
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
  // @ts-ignore
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
    const last = list.length - 1;
    for (let j = 0; j < last; j++) {
      this.setNextClusNum(list[j], list[j + 1]);
    }
    this.setNextClusNum(list[last], this.finalClus);
    return list;
  }

  /**
   * @override
   * @param {number} offset
   * @returns {?number}
   */
  // @ts-ignore
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
  // @ts-ignore
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

  /**
   * @private
   * @param {number} clusNum
   * @returns {number}
   */
  getClusOffset(clusNum) {
    assert(this.isAllocated(clusNum));
    // FAT12: clusNum + Math.floor(clusNum / 2);
    // FAT16: clusNum * 2
    // FAT32: clusNum * 4
    return Math.floor(clusNum * this.multiplier);
  }
}

/**
 * @implements {FATMath}
 */
export class FAT12Math extends FATMathBase {
  /**
   * @param {!Device} device
   * @param {!BiosParameterBlock} bpb
   * @param {!FATVariables} vars
   */
  constructor(device, bpb, vars) {
    super(device, bpb, vars, 0xfff, 1.5);
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {number}
   */
  readNextClusNum(clusNum) {
    const val = this.device.readWord();
    return clusNum & 1 ? val >> 4 : val & this.finalClus;
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} nextClusNum
   */
  writeNextClusNum(clusNum, nextClusNum) {
    assert(nextClusNum >= 0 && nextClusNum <= this.finalClus);
    const val = this.device.readWord();
    this.device.skip(-2);
    this.device.writeWord(clusNum & 1 ? (nextClusNum << 4) | (val & 0xf) : (val & 0xf000) | nextClusNum);
  }
}

/**
 * @implements {FATMath}
 */
export class FAT16Math extends FATMathBase {
  /**
   * @param {!Device} device
   * @param {!BiosParameterBlock} bpb
   * @param {!FATVariables} vars
   */
  constructor(device, bpb, vars) {
    super(device, bpb, vars, 0xffff, 2);
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {number}
   */
  // eslint-disable-next-line no-unused-vars
  readNextClusNum(clusNum) {
    return this.device.readWord();
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  writeNextClusNum(clusNum, value) {
    assert(value >= 0 && value <= this.finalClus);
    this.device.writeWord(value);
  }
}

/**
 * @implements {FATMath}
 */
export class FAT32Math extends FATMathBase {
  /**
   * @param {!Device} device
   * @param {!BiosParameterBlock} bpb
   * @param {!FATVariables} vars
   * @param {!FSInfo} fsi
   */
  constructor(device, bpb, vars, fsi) {
    super(device, bpb, vars, 0x0fffffff, 4);
    /**
    //  * @private
     * @constant
     */
    this.fsi = fsi;
  }

  /**
   * @override
   * @param {number} clusNum
   * @returns {number}
   */
  // eslint-disable-next-line no-unused-vars
  readNextClusNum(clusNum) {
    return this.device.readDoubleWord() & this.finalClus;
  }

  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  writeNextClusNum(clusNum, value) {
    assert(value >= 0 && value <= this.finalClus);
    const val = this.device.readDoubleWord();
    this.device.skip(-4);
    this.device.writeDoubleWord((val & 0xf0000000) | value);
  }
}
