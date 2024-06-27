import { BiosParameterBlock, BiosParameterBlockFAT32, BootSector, CHS, Device, DirEntry, DirEntryLFN, FATVariables, FSInfo, PartitionEntry } from "./types.mjs";
import { assert, validate } from "./support.mjs";

/**
 * @param {!Device} device
 * @returns {!CHS}
 */
function loadCHS(device) {
  const b1 = device.readByte();
  const b2 = device.readByte();
  const b3 = device.readByte();
  return {
    Cylinder: ((b2 >> 6) << 8) | b3,
    Head: b1,
    Sector: b2 & 0b111111,
  };
}

/**
 * @param {!Device} device
 * @returns {!PartitionEntry}
 */
function loadPartitionEntry(device) {
  return {
    BootIndicator: device.readByte(),
    Starting: loadCHS(device),
    SystemID: device.readByte(),
    Ending: loadCHS(device),
    RelativeSectors: device.readDoubleWord(),
    TotalSectors: device.readDoubleWord(),
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
 * @param {!Device} device
 * @returns {!Array<!PartitionEntry>}
 */
export function loadPartitionTable(device) {
  const table = [];
  for (let i = 0; i < 4; i++) {
    const e = loadPartitionEntry(device);
    if (isPartitionEntryValid(e)) {
      table.push(e);
    }
  }
  return table;
}

/**
 * @param {!Device} device
 * @returns {!BiosParameterBlock}
 */
function loadBiosParameterBlock(device) {
  return {
    BytsPerSec: device.readWord(),
    SecPerClus: device.readByte(),
    RsvdSecCnt: device.readWord(),
    NumFATs: device.readByte(),
    RootEntCnt: device.readWord(),
    TotSec16: device.readWord(),
    Media: device.readByte(),
    FATSz16: device.readWord(),
    SecPerTrk: device.readWord(),
    NumHeads: device.readWord(),
    HiddSec: device.readDoubleWord(),
    TotSec32: device.readDoubleWord(),
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
 * @param {!Device} device
 * @returns {!BiosParameterBlockFAT32}
 */
function loadBiosParameterBlockFAT32(device) {
  return {
    FATSz32: device.readDoubleWord(),
    ExtFlags: device.readWord(),
    FSVer: device.readWord(),
    RootClus: device.readDoubleWord(),
    FSInfo: device.readWord(),
    BkBootSec: device.readWord(),
    Reserved: device.readArray(12),
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
 * @param {!Device} device
 * @returns {!BootSector}
 */
function loadBootSector(device) {
  const jmpBoot = device.readArray(3);
  const oemName = device.readArray(8);
  const bpb = loadBiosParameterBlock(device);
  const bpbFAT32 = bpb.RootEntCnt === 0 ? loadBiosParameterBlockFAT32(device) : null;
  return {
    jmpBoot,
    oemName,
    bpb,
    bpbFAT32,
    DrvNum: device.readByte(),
    Reserved1: device.readByte(),
    BootSig: device.readByte(),
    VolID: device.readDoubleWord(),
    VolLab: device.readArray(11),
    FilSysType: device.readArray(8),
    BootCode: device.readArray(bpbFAT32 ? 420 : 448),
    SignatureWord: device.readWord(),
  };
}

/**
 * @param {!Device} device
 * @returns {!BootSector}
 */
export function loadAndValidateBootSector(device) {
  const bs = loadBootSector(device);
  validateBiosParameterBlock(bs.bpb);
  if (bs.bpbFAT32 !== null) {
    validateBiosParameterBlockFAT32(bs.bpbFAT32);
  }
  return bs;
}

/**
 * @param {!Device} device
 * @returns {!FSInfo}
 */
function loadFSInfo(device) {
  const LeadSig = device.readDoubleWord();
  device.skip(480);
  const StrucSig = device.readDoubleWord();
  const FreeCount = device.readDoubleWord();
  const NxtFree = device.readDoubleWord();
  device.skip(12);
  const TrailSig = device.readDoubleWord();
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
 * @param {!Device} device
 * @returns {!FSInfo}
 */
export function loadAndValidateFSInfo(device) {
  const fsi = loadFSInfo(device);
  validateFSInfo(fsi);
  return fsi;
}

/**
 * @param {!Device} device
 * @returns {!DirEntry}
 */
export function loadDirEntry(device) {
  return {
    Name: device.readArray(11),
    Attr: device.readByte(),
    NTRes: device.readByte(),
    CrtTimeTenth: device.readByte(),
    CrtTime: device.readWord(),
    CrtDate: device.readWord(),
    LstAccDate: device.readWord(),
    FstClusHI: device.readWord(),
    WrtTime: device.readWord(),
    WrtDate: device.readWord(),
    FstClusLO: device.readWord(),
    FileSize: device.readDoubleWord(),
  };
}

/**
 * @param {!Device} device
 * @param {!DirEntry} dir
 */
export function writeDirEntry(device, dir) {
  assert(dir.Name.length === 11);
  device.writeArray(dir.Name);
  device.writeByte(dir.Attr);
  device.writeByte(dir.NTRes);
  device.writeByte(dir.CrtTimeTenth);
  device.writeWord(dir.CrtTime);
  device.writeWord(dir.CrtDate);
  device.writeWord(dir.LstAccDate);
  device.writeWord(dir.FstClusHI);
  device.writeWord(dir.WrtTime);
  device.writeWord(dir.WrtDate);
  device.writeWord(dir.FstClusLO);
  device.writeDoubleWord(dir.FileSize);
}

/**
 * @param {!Device} device
 * @returns {!DirEntryLFN}
 */
export function loadDirEntryLFN(device) {
  return {
    Ord: device.readByte(),
    Name1: device.readArray(10),
    Attr: device.readByte(),
    Type: device.readByte(),
    Chksum: device.readByte(),
    Name2: device.readArray(12),
    FstClusLO: device.readWord(),
    Name3: device.readArray(4),
  };
}

/**
 * @param {!Device} device
 * @param {!DirEntryLFN} dir
 */
export function writeDirEntryLFN(device, dir) {
  assert(dir.Name1.length === 10);
  assert(dir.Name2.length === 12);
  assert(dir.Name3.length === 4);
  device.writeByte(dir.Ord);
  device.writeArray(dir.Name1);
  device.writeByte(dir.Attr);
  device.writeByte(dir.Type);
  device.writeByte(dir.Chksum);
  device.writeArray(dir.Name2);
  device.writeWord(dir.FstClusLO);
  device.writeArray(dir.Name3);
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
