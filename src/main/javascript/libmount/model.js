"use strict";

/**
 * BiosParameterBlock
 */
class BiosParameterBlock {
  /**
   * @param {number} BytsPerSec
   * @param {number} SecPerClus
   * @param {number} RsvdSecCnt
   * @param {number} NumFATs
   * @param {number} RootEntCnt
   * @param {number} TotSec16
   * @param {number} Media
   * @param {number} FATSz16
   * @param {number} SecPerTrk
   * @param {number} NumHeads
   * @param {number} HiddSec
   * @param {number} TotSec32
   */
  constructor(
    //
    BytsPerSec,
    SecPerClus,
    RsvdSecCnt,
    NumFATs,
    RootEntCnt,
    TotSec16,
    Media,
    FATSz16,
    SecPerTrk,
    NumHeads,
    HiddSec,
    TotSec32,
  ) {
    this.BytsPerSec = BytsPerSec;
    this.SecPerClus = SecPerClus;
    this.RsvdSecCnt = RsvdSecCnt;
    this.NumFATs = NumFATs;
    this.RootEntCnt = RootEntCnt;
    this.TotSec16 = TotSec16;
    this.Media = Media;
    this.FATSz16 = FATSz16;
    this.SecPerTrk = SecPerTrk;
    this.NumHeads = NumHeads;
    this.HiddSec = HiddSec;
    this.TotSec32 = TotSec32;
  }

  /**
   * @param {!BlockDevice} s
   * @returns {!BiosParameterBlock}
   */
  static load(s) {
    return new BiosParameterBlock(
      //
      s.readWord(),
      s.readByte(),
      s.readWord(),
      s.readByte(),
      s.readWord(),
      s.readWord(),
      s.readByte(),
      s.readWord(),
      s.readWord(),
      s.readWord(),
      s.readDoubleWord(),
      s.readDoubleWord(),
    );
  }
}

/**
 * BiosParameterBlockFAT32
 */
class BiosParameterBlockFAT32 {
  /**
   * @param {number} FATSz32
   * @param {number} ExtFlags
   * @param {number} FSVer
   * @param {number} RootClus
   * @param {number} FSInfo
   * @param {number} BkBootSec
   * @param {!Uint8Array} Reserved
   */
  constructor(
    //
    FATSz32,
    ExtFlags,
    FSVer,
    RootClus,
    FSInfo,
    BkBootSec,
    Reserved,
  ) {
    this.FATSz32 = FATSz32;
    this.ExtFlags = ExtFlags;
    this.FSVer = FSVer;
    this.RootClus = RootClus;
    this.FSInfo = FSInfo;
    this.BkBootSec = BkBootSec;
    this.Reserved = Reserved;
  }

  /**
   * @param {!BlockDevice} s
   * @returns {!BiosParameterBlockFAT32}
   */
  static load(s) {
    return new BiosParameterBlockFAT32(
      //
      s.readDoubleWord(),
      s.readWord(),
      s.readWord(),
      s.readDoubleWord(),
      s.readWord(),
      s.readWord(),
      s.readArray(12),
    );
  }
}

/**
 * BootSector
 */
class BootSector {
  /**
   * @param {!Uint8Array} jmpBoot
   * @param {!Uint8Array} OEMName
   * @param {!BiosParameterBlock} bpb
   * @param {?BiosParameterBlockFAT32} bpbFAT32
   * @param {number} DrvNum
   * @param {number} Reserved1
   * @param {number} BootSig
   * @param {number} VolID
   * @param {!Uint8Array} VolLab
   * @param {!Uint8Array} FilSysType
   * @param {!Uint8Array} BootCode
   * @param {number} Signature_word
   */
  constructor(
    //
    jmpBoot,
    OEMName,
    bpb,
    bpbFAT32,
    DrvNum,
    Reserved1,
    BootSig,
    VolID,
    VolLab,
    FilSysType,
    BootCode,
    Signature_word,
  ) {
    this.jmpBoot = jmpBoot;
    this.OEMName = OEMName;
    this.bpb = bpb;
    this.bpbFAT32 = bpbFAT32;
    this.DrvNum = DrvNum;
    this.Reserved1 = Reserved1;
    this.BootSig = BootSig;
    this.VolID = VolID;
    this.VolLab = VolLab;
    this.FilSysType = FilSysType;
    this.BootCode = BootCode;
    this.Signature_word = Signature_word;
  }

  /**
   * @param {!BlockDevice} s
   * @returns {!BootSector}
   */
  static load(s) {
    const jmpBoot = s.readArray(3);
    const OEMName = s.readArray(8);
    const bpb = BiosParameterBlock.load(s);
    const bpbFAT32 = bpb.RootEntCnt === 0 ? BiosParameterBlockFAT32.load(s) : null;
    return new BootSector(
      //
      jmpBoot,
      OEMName,
      bpb,
      bpbFAT32,
      s.readByte(),
      s.readByte(),
      s.readByte(),
      s.readDoubleWord(),
      s.readArray(11),
      s.readArray(8),
      s.readArray(bpbFAT32 ? 420 : 448),
      s.readWord(),
    );
  }
}

const DIR_FLAG_LAST_ENTRY = 0x00;
const DIR_FLAG_FREE_ENTRY = 0xe5;

const DIR_ATTR = {
  READ_ONLY: 0x01,
  HIDDEN: 0x02,
  SYSTEM: 0x04,
  VOLUME_ID: 0x08,
  DIRECTORY: 0x10,
  ARCHIVE: 0x20,
};

/**
 * DirEntry
 */
class DirEntry {
  /**
   * @param {!Uint8Array} Name
   * @param {number} Attr
   * @param {number} NTRes
   * @param {number} CrtTimeTenth
   * @param {number} CrtTime
   * @param {number} CrtDate
   * @param {number} LstAccDate
   * @param {number} FstClusHI
   * @param {number} WrtTime
   * @param {number} WrtDate
   * @param {number} FstClusLO
   * @param {number} FileSize
   */
  constructor(
    //
    Name,
    Attr,
    NTRes,
    CrtTimeTenth,
    CrtTime,
    CrtDate,
    LstAccDate,
    FstClusHI,
    WrtTime,
    WrtDate,
    FstClusLO,
    FileSize,
  ) {
    this.Name = Name;
    this.Attr = Attr;
    this.NTRes = NTRes;
    this.CrtTimeTenth = CrtTimeTenth;
    this.CrtTime = CrtTime;
    this.CrtDate = CrtDate;
    this.LstAccDate = LstAccDate;
    this.FstClusHI = FstClusHI;
    this.WrtTime = WrtTime;
    this.WrtDate = WrtDate;
    this.FstClusLO = FstClusLO;
    this.FileSize = FileSize;
  }

  /**
   * @param {!BlockDevice} s
   * @returns {!DirEntry}
   */
  static load(s) {
    return new DirEntry(
      //
      s.readArray(11),
      s.readByte(),
      s.readByte(),
      s.readByte(),
      s.readWord(),
      s.readWord(),
      s.readWord(),
      s.readWord(),
      s.readWord(),
      s.readWord(),
      s.readWord(),
      s.readDoubleWord(),
    );
  }
}

const DIR_LN_ATTR_LONG_NAME = DIR_ATTR.READ_ONLY | DIR_ATTR.HIDDEN | DIR_ATTR.SYSTEM | DIR_ATTR.VOLUME_ID;
const DIR_LN_LAST_LONG_ENTRY = 0x40;

/**
 * DirEntryLN
 */
class DirEntryLN {
  /**
   * @param {number} Ord
   * @param {!Uint8Array} Name1
   * @param {number} Attr
   * @param {number} Type
   * @param {number} Chksum
   * @param {!Uint8Array} Name2
   * @param {number} FstClusLO
   * @param {!Uint8Array} Name3
   */
  constructor(
    //
    Ord,
    Name1,
    Attr,
    Type,
    Chksum,
    Name2,
    FstClusLO,
    Name3,
  ) {
    this.Ord = Ord;
    this.Name1 = Name1;
    this.Attr = Attr;
    this.Type = Type;
    this.Chksum = Chksum;
    this.Name2 = Name2;
    this.FstClusLO = FstClusLO;
    this.Name3 = Name3;
  }

  /**
   * @param {!BlockDevice} s
   * @returns {!DirEntryLN}
   */
  static load(s) {
    return new DirEntryLN(
      //
      s.readByte(),
      s.readArray(10),
      s.readByte(),
      s.readByte(),
      s.readByte(),
      s.readArray(12),
      s.readWord(),
      s.readArray(4),
    );
  }
}

/**
 * FATVariables
 */
class FATVariables {
  /**
   * @param {!BootSector} bs
   */
  constructor(bs) {
    /** @type {number} */ this.RootDirSectors = Math.floor((bs.bpb.RootEntCnt * 32 + (bs.bpb.BytsPerSec - 1)) / bs.bpb.BytsPerSec);
    /** @type {number} */ this.FATSz = bs.bpbFAT32 != null ? bs.bpbFAT32.FATSz32 : bs.bpb.FATSz16;
    /** @type {number} */ this.TotSec = bs.bpb.TotSec16 != 0 ? bs.bpb.TotSec16 : bs.bpb.TotSec32;
    /** @type {number} */ this.DataSec = this.TotSec - (bs.bpb.RsvdSecCnt + bs.bpb.NumFATs * this.FATSz + this.RootDirSectors);
    /** @type {number} */ this.CountOfClusters = Math.floor(this.DataSec / bs.bpb.SecPerClus);
    /** @type {number} */ this.MAX = this.CountOfClusters + 1;
    /** @type {number} */ this.FirstRootDirSecNum = bs.bpb.RsvdSecCnt + bs.bpb.NumFATs * bs.bpb.FATSz16;
    /** @type {number} */ this.FirstDataSector = bs.bpb.RsvdSecCnt + bs.bpb.NumFATs * this.FATSz + this.RootDirSectors;
  }
}
