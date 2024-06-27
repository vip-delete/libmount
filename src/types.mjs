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

/**
 * @typedef {{
 *            longName: string,
 *            shortName: string,
 *            dirLFNs: !Array<!DirEntryLFN>,
 *            dir: !DirEntry,
 *          }}
 */
export const DirChain = {};

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
  getClusterSize() {}

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

  // specific methods

  /**
   * @returns {string}
   */
  getFileSystemName() {}

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
   * @returns {number}
   */
  getFinalClus() {}
}

/**
 * @interface
 * @template T
 */
export class NodeCrawler {
  /**
   * @param {!T} node
   * @returns {?T}
   */
  getFirst(node) {}

  /**
   * @param {!T} node
   * @returns {?T}
   */
  getNext(node) {}

  /**
   * @param {!T} node
   * @returns {!Iterable<!T>}
   */
  getSubNodes(node) {}
}

/**
 * @interface
 * @template T
 */
export class NodeBee {
  /**
   * @param {!T} node
   * @param {string} name
   * @returns {?T}
   */
  mkdir(node, name) {}

  /**
   * @param {!T} node
   * @param {string} name
   * @returns {?T}
   */
  mkfile(node, name) {}
}

/**
 * @interface
 * @template T
 */
export class FileSystemDriver {
  /**
   * @returns {string}
   */
  getFileSystemName() {}

  /**
   * @returns {!lm.VolumeInfo}
   */
  getVolumeInfo() {}

  /**
   * @returns {!T}
   */
  getRoot() {}

  /**
   * @returns {!NodeCrawler<!T>}
   */
  getCrawler() {}

  /**
   * @param {!T} node
   * @returns {?Uint8Array}
   */
  readNode(node) {}

  /**
   * @param {!T} node
   */
  deleteNode(node) {}

  /**
   * @param {!T} node
   * @param {string} name
   * @returns {?T}
   */
  mkdir(node, name) {}

  /**
   * @param {!T} node
   * @param {string} name
   * @returns {?T}
   */
  mkfile(node, name) {}
}
