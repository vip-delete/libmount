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
 *            FATSz32: number,
 *            ExtFlags: number,
 *            FSVer: number,
 *            RootClus: number,
 *            FSInfo: number,
 *            BkBootSec: number,
 *          }}
 */
export const BiosParameterBlock = {};

/**
 * @typedef {{
 *            jmpBoot: !Uint8Array,
 *            OEMName: !Uint8Array,
 *            bpb: !BiosParameterBlock,
 *            DrvNum: number,
 *            Reserved1: number,
 *            BootSig: number,
 *            VolID: number,
 *            VolLab: !Uint8Array,
 *            FilSysType: !Uint8Array,
 *            BootCode: !Uint8Array,
 *          }}
 */
export const BootSector = {};

/**
 * @typedef {{
 *            FreeCount: number,
 *            NxtFree: number,
 *          }}
 */
export const FSI = {};

/**
 * @typedef {{
 *            Name: !Uint8Array,
 *            Attributes: number,
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
 *            Attributes: number,
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
 *             FATSz: number,
 *             TotSec: number,
 *             DataSec: number,
 *             SizeOfCluster: number,
 *             CountOfClusters: number,
 *             IndexBits: number,
 *             MaxClus: number,
 *             FirstDataSec: number,
 *             RootDirOffset: number,
 *             FinalClus: number,
 *          }}
 */
export const FATVariables = {};

/**
 * @typedef {{
 *            IndexBits: number,
 *            BytsPerSecBits: number,
 *            SecPerClusBits: number,
 *            RsvdSecCnt: number,
 *            NumFATs: number,
 *            RootDirSectors: number,
 *            FATSz: number,
 *            TotSec: number,
 *            CountOfClusters: number,
 *            Media: number,
 *            NumHeads: number,
 *            SecPerTrk: number,
 *          }}
 */
export const DiskLayout = {};

/**
 * @typedef {{
 *            shortName: string,
 *            dirOffset: number,
 *            dirEntry: !DirEntry,
 *            fstClus: number,
 *            isRoot: boolean,
 *            isLabel: boolean,
 *            isRegDir: boolean,
 *            isRegFile: boolean,
 *            isDir: boolean,
 *            isReg: boolean,
 *            isLast: boolean,
 *            isDeleted: boolean,
 *            longName: string,
 *            firstDirOffset: number,
 *            dirCount: number,
 *          }}
 */
export const FATNode = {};

/* eslint-disable no-empty-function */
/* eslint-disable no-unused-vars */
/* eslint-disable class-methods-use-this */

/**
 * @interface
 */
export class IO {
  /**
   * @return {number}
   */
  pos() {}

  /**
   * @return {number}
   */
  len() {}

  /**
   * @param {number} offset
   * @return {!IO}
   */
  seek(offset) {}

  /**
   * @param {number} bytes
   * @return {!IO}
   */
  skip(bytes) {}

  /**
   * @param {number} len
   * @return {!Uint8Array}
   */
  peekUint8Array(len) {}

  /**
   * @param {number} len
   * @return {!Uint8Array}
   */
  readUint8Array(len) {}

  /**
   * @return {number}
   */
  readByte() {}

  /**
   * @return {number}
   */
  readWord() {}

  /**
   * @return {number}
   */
  readDoubleWord() {}

  /**
   * @param {!Uint8Array} array
   * @return {!IO}
   */
  writeUint8Array(array) {}

  /**
   * @param {number} byte
   * @return {!IO}
   */
  writeByte(byte) {}

  /**
   * @param {number} byte
   * @param {number} count
   * @return {!IO}
   */
  writeBytes(byte, count) {}

  /**
   * @param {number} word
   * @return {!IO}
   */
  writeWord(word) {}

  /**
   * @param {number} doubleWord
   * @return {!IO}
   */
  writeDoubleWord(doubleWord) {}
}

/**
 * @interface
 */
export class Logger {
  /**
   * @param {string} msg
   * @param {!*} [e]
   */
  warn(msg, e) {}
}

/**
 * @interface
 */
export class FAT {
  /**
   * @param {number} clusNum
   * @return {number}
   */
  getNextClusNum(clusNum) {}

  /**
   * @param {number} clusNum
   * @param {number} value
   */
  setNextClusNum(clusNum, value) {}

  /**
   * @return  {number}
   */
  getNextFreeClus() {}

  /**
   * @param {number} clusNum
   */
  setNextFreeClus(clusNum) {}
}
