import {
  BPB_FAT32_RESERVED_LENGTH,
  BS_BOOT_CODE_FAT32_LENGTH,
  BS_BOOT_CODE_LENGTH,
  BS_FIL_SYS_TYPE_LENGTH,
  BS_JUMP_BOOT_LENGTH,
  BS_OEM_NAME_LENGTH,
  BS_SIGNATURE_WORD,
  DIR_ENTRY_ATTR_DIRECTORY,
  DIR_ENTRY_ATTR_LFN,
  DIR_ENTRY_ATTR_VOLUME_ID,
  DIR_ENTRY_FLAG_DELETED,
  DIR_ENTRY_FLAG_E5,
  DIR_ENTRY_SIZE_BITS,
  DIR_NAME_LENGTH,
  FSI_LEAD_SIG,
  FSI_STRUC_SIG,
  FSI_TRAIL_SIG,
  LFN_NAME1_LENGTH,
  LFN_NAME2_LENGTH,
  LFN_NAME3_LENGTH,
  MAX_WORD,
  MIN_CLUS_NUM,
} from "./const.mjs";
import { BiosParameterBlock, BootSector, CHS, DirEntry, DirEntryLFN, FSI, IO, PartitionEntry, ValidationError } from "./types.mjs";
import { assert, toDate, toTime, toTimeTenth } from "./utils.mjs";

/**
 * @param {boolean} expression
 */
const validate = (expression) => {
  if (!expression) {
    throw new ValidationError();
  }
};

// CHS

/**
 * @param {!IO} io
 * @return {!CHS}
 */
const loadCHS = (io) => {
  const b1 = io.readByte();
  const b2 = io.readByte();
  const b3 = io.readByte();
  return {
    Cylinder: ((b2 >> 6) << 8) | b3,
    Head: b1,
    Sector: b2 & 0b111111,
  };
};

/**
 * @param {!IO} io
 * @param {!CHS} chs
 */
const writeCHS = (io, chs) => {
  const b1 = chs.Head;
  const b2 = ((chs.Cylinder >> 8) << 6) | (chs.Sector & 0b111111);
  const b3 = chs.Cylinder & 0xff;
  io.writeByte(b1).writeByte(b2).writeByte(b3);
};

// Partition Table

/**
 * @param {!IO} io
 * @return {!Array<!PartitionEntry>}
 */
export const loadPartitionTable = (io) => {
  validate(io.len() >= 512);
  io.seek(510 - 16 * 4);
  const table = [];
  for (let i = 0; i < 4; i++) {
    /**
     * @type {?PartitionEntry}
     */
    let partition = {
      BootIndicator: io.readByte(),
      Starting: loadCHS(io),
      SystemID: io.readByte(),
      Ending: loadCHS(io),
      RelativeSectors: io.readDoubleWord(),
      TotalSectors: io.readDoubleWord(),
    };
    try {
      validate(partition.SystemID > 0);
      validate([0x00, 0x80].includes(partition.BootIndicator));
      validate(partition.TotalSectors > 0);
      // CHS schema may not be correct, just ignore
      // validate(e.Starting.Sector !== 0);
      // validate(e.Ending.Sector !== 0);
      // const TH = 255; // depends on BIOS settings, may be 15, ... etc
      // const TS = 63;  // depends on BIOS settings
      // const StartingLBA = (e.Starting.Cylinder * TH + e.Starting.Head) * TS + (e.Starting.Sector - 1);
      // const EndingLBA = (e.Ending.Cylinder * TH + e.Ending.Head) * TS + (e.Ending.Sector - 1);
      // validate(StartingLBA < EndingLBA);
      // validate(StartingLBA === e.RelativeSectors);
      // validate(EndingLBA - StartingLBA + 1 === e.TotalSectors);
    } catch {
      partition = null;
    }
    if (partition) {
      table.push(partition);
    }
  }
  return table;
};

/**
 * @param {!IO} io
 * @param {!Array<!PartitionEntry>} partitions
 */
export const writePartitionTable = (io, partitions) => {
  io.seek(510 - 4 * 16);
  let i = 0;
  while (i < 4 && i < partitions.length) {
    const e = partitions[i];
    io.writeByte(e.BootIndicator);
    writeCHS(io, e.Starting);
    io.writeByte(e.SystemID);
    writeCHS(io, e.Ending);
    io.writeDoubleWord(e.RelativeSectors);
    io.writeDoubleWord(e.TotalSectors);
    i++;
  }
  io.writeBytes(0, (4 - i) * 16);
  io.writeWord(BS_SIGNATURE_WORD);
};

// BiosParameterBlock and BootSector

/**
 * @see https://github.com/microsoft/Windows-driver-samples/blob/main/filesys/fastfat/fat.h#L101
 * #define IsBpbFat32(bpb) (*(USHORT *)(&(bpb)->SectorsPerFat) == 0)
 * @param {!BiosParameterBlock} bpb
 * @return {boolean}
 */
export const isBpbFat32 = (bpb) => bpb.FATSz16 === 0;

/**
 * @param {!IO} io
 * @return {!BootSector}
 */
export const loadBootSector = (io) => {
  validate(io.len() >= 512);
  io.seek(0);
  const jmpBoot = io.readUint8Array(BS_JUMP_BOOT_LENGTH);
  const OEMName = io.readUint8Array(BS_OEM_NAME_LENGTH);
  /**
   * @type {!BiosParameterBlock}
   */
  const bpb = {
    BytsPerSec: io.readWord(),
    SecPerClus: io.readByte(),
    RsvdSecCnt: io.readWord(),
    NumFATs: io.readByte(),
    RootEntCnt: io.readWord(),
    TotSec16: io.readWord(),
    Media: io.readByte(),
    FATSz16: io.readWord(),
    SecPerTrk: io.readWord(),
    NumHeads: io.readWord(),
    HiddSec: io.readDoubleWord(),
    TotSec32: io.readDoubleWord(),
    // FAT32 specific fields
    FATSz32: -1,
    ExtFlags: -1,
    FSVer: -1,
    RootClus: -1,
    FSInfo: -1,
    BkBootSec: -1,
  };
  validate([512, 1024, 2048, 4096].includes(bpb.BytsPerSec));
  validate([1, 2, 4, 8, 16, 32, 64, 128].includes(bpb.SecPerClus));
  validate(bpb.RsvdSecCnt > 0);
  validate(bpb.NumFATs > 0);
  validate((bpb.RootEntCnt << DIR_ENTRY_SIZE_BITS) % bpb.BytsPerSec === 0);
  validate(bpb.RootEntCnt === 0 || bpb.FATSz16 > 0);
  validate(bpb.TotSec16 > 0 || bpb.TotSec32 > MAX_WORD);
  if (isBpbFat32(bpb)) {
    bpb.FATSz32 = io.readDoubleWord();
    bpb.ExtFlags = io.readWord();
    bpb.FSVer = io.readWord();
    bpb.RootClus = io.readDoubleWord();
    bpb.FSInfo = io.readWord();
    bpb.BkBootSec = io.readWord();
    io.skip(BPB_FAT32_RESERVED_LENGTH);
    validate(bpb.RootClus >= MIN_CLUS_NUM);
    validate(bpb.BkBootSec >= 0);
    validate(bpb.FSInfo > 0);
  }

  /**
   * @type {!BootSector}
   */
  const bs = {
    jmpBoot,
    OEMName,
    bpb,
    DrvNum: io.readByte(),
    Reserved1: io.readByte(),
    BootSig: io.readByte(),
    VolID: io.readDoubleWord(),
    VolLab: io.readUint8Array(DIR_NAME_LENGTH),
    FilSysType: io.readUint8Array(BS_FIL_SYS_TYPE_LENGTH),
    BootCode: io.readUint8Array(510 - io.pos()),
  };
  return bs;
};

/**
 * @param {!IO} io
 * @param {!BootSector} bs
 */
export const writeBootSector = (io, bs) => {
  io.seek(0);
  const { bpb } = bs;
  const bpbFat32 = isBpbFat32(bpb);
  assert(bs.jmpBoot.length === BS_JUMP_BOOT_LENGTH);
  assert(bs.OEMName.length === BS_OEM_NAME_LENGTH);
  assert(bs.VolLab.length === DIR_NAME_LENGTH);
  assert(bs.FilSysType.length === BS_FIL_SYS_TYPE_LENGTH);
  assert(bs.BootCode.length === (bpbFat32 ? BS_BOOT_CODE_FAT32_LENGTH : BS_BOOT_CODE_LENGTH));
  io.writeUint8Array(bs.jmpBoot)
    .writeUint8Array(bs.OEMName)
    .writeWord(bpb.BytsPerSec)
    .writeByte(bpb.SecPerClus)
    .writeWord(bpb.RsvdSecCnt)
    .writeByte(bpb.NumFATs)
    .writeWord(bpb.RootEntCnt)
    .writeWord(bpb.TotSec16)
    .writeByte(bpb.Media)
    .writeWord(bpb.FATSz16)
    .writeWord(bpb.SecPerTrk)
    .writeWord(bpb.NumHeads)
    .writeDoubleWord(bpb.HiddSec)
    .writeDoubleWord(bpb.TotSec32);
  if (bpbFat32) {
    io.writeDoubleWord(bpb.FATSz32)
      .writeWord(bpb.ExtFlags)
      .writeWord(bpb.FSVer)
      .writeDoubleWord(bpb.RootClus)
      .writeWord(bpb.FSInfo)
      .writeWord(bpb.BkBootSec)
      .skip(BPB_FAT32_RESERVED_LENGTH);
  }
  io.writeByte(bs.DrvNum)
    .writeByte(bs.Reserved1)
    .writeByte(bs.BootSig)
    .writeDoubleWord(bs.VolID)
    .writeUint8Array(bs.VolLab)
    .writeUint8Array(bs.FilSysType)
    .writeUint8Array(bs.BootCode)
    .writeWord(BS_SIGNATURE_WORD);
  assert(io.pos() === 512);
};

// FSInfo for FAT32

/**
 * @param {!IO} io
 * @return {!FSI}
 */
export const loadFSI = (io) => {
  const LeadSig = io.readDoubleWord();
  const StrucSig = io.skip(480).readDoubleWord();
  const FreeCount = io.readDoubleWord();
  const NxtFree = io.readDoubleWord();
  const TrailSig = io.skip(12).readDoubleWord();
  validate(LeadSig === FSI_LEAD_SIG && StrucSig === FSI_STRUC_SIG && TrailSig === FSI_TRAIL_SIG);
  return {
    FreeCount,
    NxtFree,
  };
};

/**
 * @param {!IO} io
 * @param {!FSI} fsInfo
 */
export const writeFSI = (io, fsInfo) => {
  io.writeDoubleWord(FSI_LEAD_SIG)
    .writeBytes(0, 480)
    .writeDoubleWord(FSI_STRUC_SIG)
    .writeDoubleWord(fsInfo.FreeCount)
    .writeDoubleWord(fsInfo.NxtFree)
    .writeBytes(0, 12)
    .writeDoubleWord(FSI_TRAIL_SIG);
};

/**
 * @param {!IO} io
 * @return {boolean}
 */
export const isDirEntryLFN = (io) => {
  const flag = io.skip(DIR_NAME_LENGTH).readByte() === DIR_ENTRY_ATTR_LFN;
  io.skip(-DIR_NAME_LENGTH - 1);
  return flag;
};

/**
 * @param {!IO} io
 * @return {!DirEntry}
 */
const readDirEntry = (io) => ({
  Name: io.readUint8Array(DIR_NAME_LENGTH),
  Attributes: io.readByte(),
  NTRes: io.readByte(),
  CrtTimeTenth: io.readByte(),
  CrtTime: io.readWord(),
  CrtDate: io.readWord(),
  LstAccDate: io.readWord(),
  FstClusHI: io.readWord(),
  WrtTime: io.readWord(),
  WrtDate: io.readWord(),
  FstClusLO: io.readWord(),
  FileSize: io.readDoubleWord(),
});

/**
 * @param {!IO} io
 * @return {!DirEntry}
 */
export const loadDirEntry = (io) => {
  const dir = readDirEntry(io);
  if (dir.Name[0] === DIR_ENTRY_FLAG_E5) {
    dir.Name[0] = DIR_ENTRY_FLAG_DELETED;
  }
  return dir;
};

/**
 * @param {!IO} io
 * @param {number} offset
 * @param {!DirEntry} dirEntry
 */
export const writeDirEntry = (io, offset, dirEntry) => {
  assert(dirEntry.Name.length === DIR_NAME_LENGTH);
  if (dirEntry.Name[0] === DIR_ENTRY_FLAG_DELETED) {
    dirEntry.Name[0] = DIR_ENTRY_FLAG_E5;
  }
  io.seek(offset)
    .writeUint8Array(dirEntry.Name)
    .writeByte(dirEntry.Attributes)
    .writeByte(dirEntry.NTRes)
    .writeByte(dirEntry.CrtTimeTenth)
    .writeWord(dirEntry.CrtTime)
    .writeWord(dirEntry.CrtDate)
    .writeWord(dirEntry.LstAccDate)
    .writeWord(dirEntry.FstClusHI)
    .writeWord(dirEntry.WrtTime)
    .writeWord(dirEntry.WrtDate)
    .writeWord(dirEntry.FstClusLO)
    .writeDoubleWord(dirEntry.FileSize);
};

/**
 * @param {!IO} io
 * @param {number} offset
 * @param {!DirEntryLFN} dir
 */
export const writeDirEntryLFN = (io, offset, dir) => {
  assert(dir.Name1.length === LFN_NAME1_LENGTH);
  assert(dir.Name2.length === LFN_NAME2_LENGTH);
  assert(dir.Name3.length === LFN_NAME3_LENGTH);
  io.seek(offset)
    .writeByte(dir.Ord)
    .writeUint8Array(dir.Name1)
    .writeByte(dir.Attributes)
    .writeByte(dir.Type)
    .writeByte(dir.Chksum)
    .writeUint8Array(dir.Name2)
    .writeWord(dir.FstClusLO)
    .writeUint8Array(dir.Name3);
};

/**
 * @param {!IO} io
 * @return {!DirEntryLFN}
 */
export const loadDirEntryLFN = (io) => ({
  Ord: io.readByte(),
  Name1: io.readUint8Array(LFN_NAME1_LENGTH),
  Attributes: io.readByte(),
  Type: io.readByte(),
  Chksum: io.readByte(),
  Name2: io.readUint8Array(LFN_NAME2_LENGTH),
  FstClusLO: io.readWord(),
  Name3: io.readUint8Array(LFN_NAME3_LENGTH),
});

/**
 * @param {!Uint8Array} sfn
 * @return {!DirEntry}
 */
export const createVolumeDirEntry = (sfn) => {
  const now = new Date();
  return {
    Name: sfn,
    Attributes: DIR_ENTRY_ATTR_VOLUME_ID,
    NTRes: 0,
    CrtTimeTenth: 0,
    CrtTime: 0,
    CrtDate: 0,
    LstAccDate: 0,
    FstClusHI: 0,
    WrtTime: toTime(now),
    WrtDate: toDate(now),
    FstClusLO: 0,
    FileSize: 0,
  };
};

/**
 * @param {!Uint8Array} sfn
 * @param {!DirEntry} dir
 * @return {!DirEntry}
 */
export const createDotDirEntry = (sfn, dir) => ({
  Name: sfn,
  Attributes: DIR_ENTRY_ATTR_DIRECTORY,
  NTRes: 0,
  CrtTimeTenth: dir.CrtTimeTenth,
  CrtTime: dir.CrtTime,
  CrtDate: dir.CrtDate,
  LstAccDate: dir.LstAccDate,
  FstClusHI: dir.FstClusHI,
  WrtTime: dir.WrtTime,
  WrtDate: dir.WrtDate,
  FstClusLO: dir.FstClusLO,
  FileSize: 0,
});

/**
 * @param {!Uint8Array} Name
 * @param {?Date} dateTime
 * @return {!DirEntry}
 */
export const createDirEntry = (Name, dateTime) => {
  const date = toDate(dateTime);
  const time = toTime(dateTime);
  const timeTenth = toTimeTenth(dateTime);
  return {
    Name,
    Attributes: 0,
    NTRes: 0,
    CrtTimeTenth: timeTenth,
    CrtTime: time,
    CrtDate: date,
    LstAccDate: date,
    FstClusHI: 0,
    WrtTime: time,
    WrtDate: date,
    FstClusLO: 0,
    FileSize: 0,
  };
};
