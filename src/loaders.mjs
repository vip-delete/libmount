import {
  BiosParameterBlock,
  BiosParameterBlockFAT32,
  BootSector,
  CHS,
  Device,
  DirEntry,
  DirEntryLFN,
  FATVariables,
  FSInfo,
  PartitionEntry,
} from "./types.mjs";
import { validate } from "./support.mjs";

/**
 * @param {!Device} s
 * @returns {!CHS}
 */
function loadCHS(s) {
  const b1 = s.readByte();
  const b2 = s.readByte();
  const b3 = s.readByte();
  return {
    Cylinder: ((b2 >> 6) << 8) | b3,
    Head: b1,
    Sector: b2 & 0b111111,
  };
}

/**
 * @param {!Device} s
 * @returns {!PartitionEntry}
 */
function loadPartitionEntry(s) {
  return {
    BootIndicator: s.readByte(),
    Starting: loadCHS(s),
    SystemID: s.readByte(),
    Ending: loadCHS(s),
    RelativeSectors: s.readDoubleWord(),
    TotalSectors: s.readDoubleWord(),
  };
}

/**
 * @param {!PartitionEntry} e
 */
function validatePartitionEntry(e) {
  validate([0x00, 0x80].includes(e.BootIndicator));
  validate(e.Starting.Sector !== 0);
  validate(e.Ending.Sector !== 0);
  const StartingLBA = (e.Starting.Cylinder * 255 + e.Starting.Head) * 63 + (e.Starting.Sector - 1);
  const EndingLBA = (e.Ending.Cylinder * 255 + e.Ending.Head) * 63 + (e.Ending.Sector - 1);
  validate(StartingLBA < EndingLBA);
  validate(StartingLBA === e.RelativeSectors);
  validate(EndingLBA - StartingLBA + 1 === e.TotalSectors);
}

/**
 * @param {!PartitionEntry} e
 * @returns {boolean}
 */
function isPartitionEntryValid(e) {
  try {
    validatePartitionEntry(e);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {!Device} s
 * @returns {!Array<!PartitionEntry>}
 */
export function loadPartitionTable(s) {
  const table = [];
  for (let i = 0; i < 4; i++) {
    const e = loadPartitionEntry(s);
    if (isPartitionEntryValid(e)) {
      table.push(e);
    }
  }
  return table;
}

/**
 * @param {!Device} s
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
 * @param {!BiosParameterBlock} bpb
 */
function validateBiosParameterBlock(bpb) {
  validate([512, 1024, 2048, 4096].includes(bpb.BytsPerSec));
  validate([1, 2, 4, 8, 16, 32, 64, 128].includes(bpb.SecPerClus));
  validate(bpb.RsvdSecCnt > 0);
  validate(bpb.NumFATs > 0);
  validate((bpb.RootEntCnt * 32) % bpb.BytsPerSec === 0);
  validate([0xf0, 0xf8, 0xf9, 0xfa, 0xfb, 0xfc, 0xfd, 0xfe, 0xff].includes(bpb.Media));
  validate(bpb.RootEntCnt === 0 || bpb.FATSz16 > 0);
  validate(bpb.TotSec16 === 0 ? bpb.TotSec32 >= 0x10000 : bpb.TotSec32 === 0);
}

/**
 * @param {!Device} s
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
 * @param {!BiosParameterBlockFAT32} bpbFAT32
 */
function validateBiosParameterBlockFAT32(bpbFAT32) {
  validate(bpbFAT32.FSVer === 0);
  validate(bpbFAT32.RootClus >= 2);
  validate(bpbFAT32.BkBootSec === 0 || bpbFAT32.BkBootSec === 6);
  validate(bpbFAT32.RootClus >= 2);
}

/**
 * @param {!Device} s
 * @returns {!BootSector}
 */
function loadBootSector(s) {
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
 * @param {!Device} s
 * @returns {!BootSector}
 */
export function loadAndValidateBootSector(s) {
  const bs = loadBootSector(s);
  validateBiosParameterBlock(bs.bpb);
  if (bs.bpbFAT32 !== null) {
    validateBiosParameterBlockFAT32(bs.bpbFAT32);
  }
  return bs;
}

/**
 * @param {!Device} s
 * @returns {!FSInfo}
 */
function loadFSInfo(s) {
  const LeadSig = s.readDoubleWord();
  s.skip(480);
  const StrucSig = s.readDoubleWord();
  const FreeCount = s.readDoubleWord();
  const NxtFree = s.readDoubleWord();
  s.skip(12);
  const TrailSig = s.readDoubleWord();
  return {
    LeadSig,
    StrucSig,
    FreeCount,
    NxtFree,
    TrailSig,
  };
}

/**
 * @param {!FSInfo} fsi
 */
function validateFSInfo(fsi) {
  validate(fsi.LeadSig === 0x41615252);
  validate(fsi.StrucSig === 0x61417272);
  validate(fsi.TrailSig === 0xaa550000);
}

/**
 * @param {!Device} s
 * @returns {!FSInfo}
 */
export function loadAndValidateFSInfo(s) {
  const fsi = loadFSInfo(s);
  validateFSInfo(fsi);
  return fsi;
}

/**
 * @param {!Device} s
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
 * @param {!Device} s
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
  const bpb = bs.bpb;
  const bpbFAT32 = bs.bpbFAT32;
  const FATSz16 = bpb.FATSz16;
  const TotSec16 = bpb.TotSec16;
  const BytsPerSec = bpb.BytsPerSec;
  const SecPerClus = bpb.SecPerClus;
  const RsvdSecCnt = bpb.RsvdSecCnt;
  const NumFATs = bpb.NumFATs;

  const RootDirSectors = Math.floor((bpb.RootEntCnt * 32 + (BytsPerSec - 1)) / BytsPerSec);
  const FATSz = bpbFAT32 === null ? FATSz16 : bpbFAT32.FATSz32;
  const TotSec = TotSec16 === 0 ? bpb.TotSec32 : TotSec16;
  const DataSec = TotSec - (RsvdSecCnt + NumFATs * FATSz + RootDirSectors);
  const SizeOfCluster = BytsPerSec * SecPerClus;
  const CountOfClusters = Math.floor(DataSec / SecPerClus);
  const MaxClus = CountOfClusters + 1;
  const FirstRootDirSecNum = RsvdSecCnt + NumFATs * FATSz16;
  const FirstDataSector = RsvdSecCnt + NumFATs * FATSz + RootDirSectors;
  const RootDirOffset = BytsPerSec * (bpbFAT32 === null ? FirstRootDirSecNum : FirstDataSector + (bpbFAT32.RootClus - 2) * SecPerClus);

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
    RootDirOffset,
  };
}
