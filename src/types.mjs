// @ts-nocheck
/**
 * @typedef {{
 *            Cylinder: number,
 *            Head: number,
 *            Sector: number,
 *          }}
 */
export const CHS = {};

/**
 * @typedef {{
 *            BootIndicator: number,
 *            Starting: !CHS,
 *            SystemID: number,
 *            Ending: !CHS,
 *            RelativeSectors: number,
 *            TotalSectors: number,
 *          }}
 */
export const PartitionEntry = {};

/**
 * @typedef {{
 *            BytsPerSec: number,
 *            SecPerClus: number,
 *            RsvdSecCnt: number,
 *            NumFATs: number,
 *            RootEntCnt: number,
 *            TotSec16: number,
 *            Media: number,
 *            FATSz16: number,
 *            SecPerTrk: number,
 *            NumHeads: number,
 *            HiddSec: number,
 *            TotSec32: number,
 *          }}
 */
export const BiosParameterBlock = {};

/**
 * @typedef {{
 *            FATSz32: number,
 *            ExtFlags: number,
 *            FSVer: number,
 *            RootClus: number,
 *            FSInfo: number,
 *            BkBootSec: number,
 *            Reserved: !Uint8Array,
 *          }}
 */
export const BiosParameterBlockFAT32 = {};

/**
 * @typedef {{
 *            jmpBoot: !Uint8Array,
 *            oemName: !Uint8Array,
 *            bpb: !BiosParameterBlock,
 *            bpbFAT32: ?BiosParameterBlockFAT32,
 *            DrvNum: number,
 *            Reserved1: number,
 *            BootSig: number,
 *            VolID: number,
 *            VolLab: !Uint8Array,
 *            FilSysType: !Uint8Array,
 *            BootCode: !Uint8Array,
 *            SignatureWord: number,
 *          }}
 */
export const BootSector = {};

/**
 * @typedef {{
 *            LeadSig: number,
 *            StrucSig: number,
 *            FreeCount: number,
 *            NxtFree: number,
 *            TrailSig: number,
 *          }}
 */
export const FSInfo = {};

/**
 * @typedef {{
 *            Name: !Uint8Array,
 *            Attr: number,
 *            NTRes: number,
 *            CrtTimeTenth: number,
 *            CrtTime: number,
 *            CrtDate: number,
 *            LstAccDate: number,
 *            FstClusHI: number,
 *            WrtTime: number,
 *            WrtDate: number,
 *            FstClusLO: number,
 *            FileSize: number,
 *          }}
 */
export const DirEntry = {};

export const DIR_ENTRY_SIZE = 32;

/**
 * @typedef {{
 *            Ord: number,
 *            Name1: !Uint8Array,
 *            Attr: number,
 *            Type: number,
 *            Chksum: number,
 *            Name2: !Uint8Array,
 *            FstClusLO: number,
 *            Name3: !Uint8Array,
 *          }}
 */
export const DirEntryLFN = {};

/**
 * @typedef {{
 *             RootDirSectors: number,
 *             FATSz: number,
 *             TotSec: number,
 *             DataSec: number,
 *             SizeOfCluster: number,
 *             CountOfClusters: number,
 *             MaxClus: number,
 *             FirstRootDirSecNum: number,
 *             FirstDataSector: number,
 *             RootDirOffset: number,
 *          }}
 */
export const FATVariables = {};

/* eslint-disable no-empty-function */
/* eslint-disable no-unused-vars */

/**
 * @interface
 */
export class Device {
  /**
   * @param {number} offset
   */
  seek(offset) {}

  /**
   * @param {number} bytes
   */
  skip(bytes) {}

  /**
   * @returns {number}
   */
  length() {}

  /**
   * @param {number} len
   * @returns {!Uint8Array}
   */
  readArray(len) {}

  /**
   * @returns {number}
   */
  readByte() {}

  /**
   * @returns {number}
   */
  readWord() {}

  /**
   * @returns {number}
   */
  readDoubleWord() {}

  /**
   * @param {!Uint8Array} array
   */
  writeArray(array) {}

  /**
   * @param {number} byte
   */
  writeByte(byte) {}

  /**
   * @param {number} word
   */
  writeWord(word) {}

  /**
   * @param {number} doubleWord
   */
  writeDoubleWord(doubleWord) {}
}

/**
 * @interface
 */
export class FATMath {
  /**
   * @returns {number}
   */
  getRootDirOffset() {}

  /**
   * @param {number} clusNum
   * @returns {?number}
   */
  getContentOffset(clusNum) {}

  /**
   * @param {number} clusNum
   * @returns {boolean}
   */
  isAllocated(clusNum) {}

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getNextClusNum(clusNum) {}

  /**
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum(clusNum, value) {}

  /**
   * @param {number} clusNum
   * @returns {null}
   */
  writeZeros(clusNum) {}

  /**
   * @param {number} clusNum
   */
  setFreeClusNum(clusNum) {}

  /**
   * @param {number} clusNum
   */
  setFinalClusNum(clusNum) {}

  /**
   * @returns {number}
   */
  getFreeClusters() {}

  /**
   * @param {number} count
   * @returns {?Array<number>}
   */
  allocateClusters(count) {}

  /**
   * @param {number} offset
   * @returns {?number}
   */
  getNextDirEntryOffset(offset) {}

  /**
   * @param {number} offset
   * @returns {?number}
   */
  getClusNum(offset) {}
}

/**
 * @interface
 */
export class FATNode {
  /**
   * @returns {string}
   */
  getLongName() {}

  /**
   * @returns {string}
   */
  getShortName() {}

  /**
   * @returns {number}
   */
  getFirstDirOffset() {}

  /**
   * @returns {number}
   */
  getLastDirOffset() {}

  /**
   * @returns {number}
   */
  getDirCount() {}

  /**
   * @returns {!DirEntry}
   */
  getDirEntry() {}

  /**
   * @returns {boolean}
   */
  isRoot() {}

  /**
   * @returns {boolean}
   */
  isRegularDir() {}

  /**
   * @returns {boolean}
   */
  isRegularFile() {}

  /**
   * @returns {boolean}
   */
  isVolumeId() {}

  /**
   * @returns {boolean}
   */
  isDot() {}

  /**
   * @returns {boolean}
   */
  isDotDot() {}

  /**
   * @returns {boolean}
   */
  isInvalid() {}

  /**
   * @returns {boolean}
   */
  isDeleted() {}

  /**
   * @returns {boolean}
   */
  isDeletedLFN() {}

  /**
   * @returns {boolean}
   */
  isLast() {}
}

/**
 * @interface
 */
export class FATCrawler {
  /**
   * @param {!FATNode} node
   * @returns {!Iterable<!FATNode>}
   */
  getSubNodes(node) {}
}

/**
 * @interface
 */
export class FATDriver {
  /**
   * @returns {string}
   */
  getFileSystemName() {}

  /**
   * @returns {!lmNS.Volume}
   */
  getVolume() {}

  /**
   * @returns {!FATNode}
   */
  getRoot() {}

  /**
   * @returns {!FATCrawler}
   */
  getCrawler() {}

  /**
   * @param {!FATNode} node
   * @returns {number}
   */
  getSizeOnDisk(node) {}

  /**
   * @param {!FATNode} node
   * @returns {?Uint8Array}
   */
  readNode(node) {}

  /**
   * @param {!FATNode} node
   * @param {!Uint8Array} data
   * @returns {?FATNode}
   */
  writeNode(node, data) {}

  /**
   * @param {!FATNode} node
   */
  deleteNode(node) {}

  /**
   * @param {!FATNode} node
   * @param {string} name
   * @param {boolean} isDirectory
   * @returns {?FATNode}
   */
  makeNode(node, name, isDirectory) {}

  /**
   * @param {!FATNode} src
   * @param {!FATNode} dest
   */
  moveNode(src, dest) {}
}
