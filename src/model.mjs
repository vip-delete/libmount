import { BlockDevice } from "./io.mjs";

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
 *            OEMName: !Uint8Array,
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
 *          }}
 */
export const FATVariables = {};

/**
 * @param {!BlockDevice} s
 * @returns {!BiosParameterBlock}
 */
function loadBiosParameterBlock(s) {
  return {
    BytsPerSec: s.readWord(),
    SecPerClus: s.readByte(),
    RsvdSecCnt: s.readWord(),
    NumFATs: s.readByte(),
    RootEntCnt: s.readWord(),
    TotSec16: s.readWord(),
    Media: s.readByte(),
    FATSz16: s.readWord(),
    SecPerTrk: s.readWord(),
    NumHeads: s.readWord(),
    HiddSec: s.readDoubleWord(),
    TotSec32: s.readDoubleWord(),
  };
}

/**
 * @param {!BlockDevice} s
 * @returns {!BiosParameterBlockFAT32}
 */
function loadBiosParameterBlockFAT32(s) {
  return {
    FATSz32: s.readDoubleWord(),
    ExtFlags: s.readWord(),
    FSVer: s.readWord(),
    RootClus: s.readDoubleWord(),
    FSInfo: s.readWord(),
    BkBootSec: s.readWord(),
    Reserved: s.readArray(12),
  };
}

/**
 * @param {!BlockDevice} s
 * @returns {!BootSector}
 */
export function loadBootSector(s) {
  const jmpBoot = s.readArray(3);
  const OEMName = s.readArray(8);
  const bpb = loadBiosParameterBlock(s);
  const bpbFAT32 = bpb.RootEntCnt === 0 ? loadBiosParameterBlockFAT32(s) : null;
  return {
    jmpBoot,
    OEMName,
    bpb,
    bpbFAT32,
    DrvNum: s.readByte(),
    Reserved1: s.readByte(),
    BootSig: s.readByte(),
    VolID: s.readDoubleWord(),
    VolLab: s.readArray(11),
    FilSysType: s.readArray(8),
    BootCode: s.readArray(bpbFAT32 ? 420 : 448),
    SignatureWord: s.readWord(),
  };
}

/**
 * @param {!BlockDevice} s
 * @returns {!DirEntry}
 */
export function loadDirEntry(s) {
  return {
    Name: s.readArray(11),
    Attr: s.readByte(),
    NTRes: s.readByte(),
    CrtTimeTenth: s.readByte(),
    CrtTime: s.readWord(),
    CrtDate: s.readWord(),
    LstAccDate: s.readWord(),
    FstClusHI: s.readWord(),
    WrtTime: s.readWord(),
    WrtDate: s.readWord(),
    FstClusLO: s.readWord(),
    FileSize: s.readDoubleWord(),
  };
}

/**
 * @param {!BlockDevice} s
 * @returns {!DirEntryLFN}
 */
export function loadDirEntryLFN(s) {
  return {
    Ord: s.readByte(),
    Name1: s.readArray(10),
    Attr: s.readByte(),
    Type: s.readByte(),
    Chksum: s.readByte(),
    Name2: s.readArray(12),
    FstClusLO: s.readWord(),
    Name3: s.readArray(4),
  };
}

/**
 * @param {!BootSector} bs
 * @returns {!FATVariables}
 */
export function loadFATVariables(bs) {
  const RootDirSectors = Math.floor((bs.bpb.RootEntCnt * 32 + (bs.bpb.BytsPerSec - 1)) / bs.bpb.BytsPerSec);
  const FATSz = bs.bpbFAT32 === null ? bs.bpb.FATSz16 : bs.bpbFAT32.FATSz32;
  const TotSec = bs.bpb.TotSec16 === 0 ? bs.bpb.TotSec32 : bs.bpb.TotSec16;
  const DataSec = TotSec - (bs.bpb.RsvdSecCnt + bs.bpb.NumFATs * FATSz + RootDirSectors);
  const SizeOfCluster = bs.bpb.BytsPerSec * bs.bpb.SecPerClus;
  const CountOfClusters = Math.floor(DataSec / bs.bpb.SecPerClus);
  const MaxClus = CountOfClusters + 1;
  const FirstRootDirSecNum = bs.bpb.RsvdSecCnt + bs.bpb.NumFATs * bs.bpb.FATSz16;
  const FirstDataSector = bs.bpb.RsvdSecCnt + bs.bpb.NumFATs * FATSz + RootDirSectors;
  return {
    RootDirSectors,
    FATSz,
    TotSec,
    DataSec,
    SizeOfCluster,
    CountOfClusters,
    MaxClus,
    FirstRootDirSecNum,
    FirstDataSector,
  };
}

/**
 * @enum
 */
export const FATNodeKind = {
  ROOT: 0,
  VOLUME_ID: 1,
  DELETED: 2,
  CURRENT_DIR: 3,
  PARENT_DIR: 4,
  REGULAR_FILE: 5,
  REGULAR_DIR: 6,
};

export class FATNode {
  /**
   * @param {number} kind
   * @param {string} shortName
   * @param {?string} longName
   * @param {number} offset
   * @param {number} dirs
   * @param {?DirEntry} dirEntry
   */
  constructor(kind, shortName, longName, offset, dirs, dirEntry) {
    this.kind = kind;
    this.shortName = shortName;
    this.longName = longName;
    this.offset = offset;
    this.dirs = dirs;
    this.dirEntry = dirEntry;
  }

  /**
   * @returns {string}
   */
  getName() {
    return this.longName ?? this.shortName;
  }

  /**
   * @returns {number}
   */
  getFileSize() {
    return this.dirEntry?.FileSize ?? 0;
  }

  /**
   * @returns {number}
   */
  getClusNum() {
    return this.dirEntry?.FstClusLO ?? 0;
  }

  /**
   * @returns {boolean}
   */
  isRoot() {
    return this.kind === FATNodeKind.ROOT;
  }

  /**
   * @returns {boolean}
   */
  isRegularFile() {
    return this.kind === FATNodeKind.REGULAR_FILE;
  }

  /**
   * @returns {boolean}
   */
  isRegularDirectory() {
    return this.kind === FATNodeKind.REGULAR_DIR;
  }

  /**
   * @returns {boolean}
   */
  isRegular() {
    return this.isRegularFile() || this.isRegularDirectory();
  }
}

/* eslint-disable no-unused-vars */
/* eslint-disable no-empty-function */

/**
 * @interface
 */
export class FATDriver {
  /**
   * @returns {string}
   */
  getFileSystemName() {}

  /**
   * @returns {!lm.VolumeInfo}
   */
  getVolumeInfo() {}

  /**
   * @returns {!FATNode}
   */
  getRoot() {}

  /**
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getNext(node) {}

  /**
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getFirst(node) {}

  /**
   * @param {!FATNode} node
   * @returns {?Uint8Array}
   */
  readNode(node) {}

  /**
   * @param {!FATNode} node
   */
  deleteNode(node) {}
}
