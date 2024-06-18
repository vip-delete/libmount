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
let BiosParameterBlock;

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
let BiosParameterBlockFAT32;

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
 *            Signature_word: number,
 *          }}
 */
export let BootSector;

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
export let DirEntry;

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
export let DirEntryLN;

/**
 * @typedef {{
 *             RootDirSectors: number,
 *             FATSz: number,
 *             TotSec: number,
 *             DataSec: number,
 *             CountOfClusters: number,
 *             MAX: number,
 *             FirstRootDirSecNum: number,
 *             FirstDataSector: number,
 *          }}
 */
export let FATVariables;

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
    jmpBoot: jmpBoot,
    OEMName: OEMName,
    bpb: bpb,
    bpbFAT32: bpbFAT32,
    DrvNum: s.readByte(),
    Reserved1: s.readByte(),
    BootSig: s.readByte(),
    VolID: s.readDoubleWord(),
    VolLab: s.readArray(11),
    FilSysType: s.readArray(8),
    BootCode: s.readArray(bpbFAT32 ? 420 : 448),
    Signature_word: s.readWord(),
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
 * @returns {!DirEntryLN}
 */
export function loadDirEntryLN(s) {
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
  /** @type {number} */ const RootDirSectors = Math.floor((bs.bpb.RootEntCnt * 32 + (bs.bpb.BytsPerSec - 1)) / bs.bpb.BytsPerSec);
  /** @type {number} */ const FATSz = bs.bpbFAT32 !== null ? bs.bpbFAT32.FATSz32 : bs.bpb.FATSz16;
  /** @type {number} */ const TotSec = bs.bpb.TotSec16 !== 0 ? bs.bpb.TotSec16 : bs.bpb.TotSec32;
  /** @type {number} */ const DataSec = TotSec - (bs.bpb.RsvdSecCnt + bs.bpb.NumFATs * FATSz + RootDirSectors);
  /** @type {number} */ const CountOfClusters = Math.floor(DataSec / bs.bpb.SecPerClus);
  /** @type {number} */ const MAX = CountOfClusters + 1;
  /** @type {number} */ const FirstRootDirSecNum = bs.bpb.RsvdSecCnt + bs.bpb.NumFATs * bs.bpb.FATSz16;
  /** @type {number} */ const FirstDataSector = bs.bpb.RsvdSecCnt + bs.bpb.NumFATs * FATSz + RootDirSectors;
  return {
    RootDirSectors,
    FATSz,
    TotSec,
    DataSec,
    CountOfClusters,
    MAX,
    FirstRootDirSecNum,
    FirstDataSector,
  };
}

/**
 * @enum
 */
export const FAT_NODE = {
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
   * @param {number} dirSize
   * @param {?DirEntry} dirEntry
   */
  constructor(kind, shortName, longName, offset, dirSize, dirEntry) {
    /** @type {number}  */ this.kind = kind;
    /** @type {string}  */ this.shortName = shortName;
    /** @type {?string} */ this.longName = longName;
    /** @type {number}  */ this.offset = offset;
    /** @type {number}  */ this.dirSize = dirSize;
    /** @type {?DirEntry}  */ this.dirEntry = dirEntry;
  }

  /**
   * @returns {string}
   */
  getName() {
    return this.longName !== null ? this.longName : this.shortName;
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
}

/**
 * @interface
 */
export class FATDriver {
  /**
   * @returns {!LibMount.VolumeInfo}
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
  // eslint-disable-next-line no-unused-vars
  getNext(node) {}

  /**
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  // eslint-disable-next-line no-unused-vars
  getFirst(node) {}

  /**
   * @param {!FATNode} node
   * @returns {?Uint8Array}
   */
  // eslint-disable-next-line no-unused-vars
  readNode(node) {}

  /**
   * @param {!FATNode} node
   */
  // eslint-disable-next-line no-unused-vars
  deleteNode(node) {}
}
