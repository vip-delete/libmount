import { BootCode12, BootCode32, jmpBoot12, jmpBoot32 } from "./bs.mjs";
import {
  BS_BOOT_CODE_FAT32_LENGTH,
  BS_BOOT_CODE_LENGTH,
  BS_FIL_SYS_TYPE_LENGTH,
  BS_JUMP_BOOT_LENGTH,
  BS_OEM_NAME_LENGTH,
  COUNT_OF_CLUSTERS_COMPATIBILITY,
  DIR_ENTRY_SIZE_BITS,
  DIR_NAME_LENGTH,
  MAX_BYTE,
  MAX_DOUBLE_WORD,
  MAX_WORD,
  MIN_CLUS_NUM,
  WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT12,
  WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT16,
  WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT32,
  WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT12,
  WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT16,
  WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT32,
} from "./const.mjs";
import { createIO } from "./io.mjs";

import { createVolumeDirEntry, writeBootSector, writeDirEntry, writeFSI } from "./dao.mjs";
import { BootSector, DiskLayout } from "./types.mjs";
import { assert, str2bytes, toDate, toTime } from "./utils.mjs";

/**
 * 2^9 = 512
 */
const BYTES_PER_SECTOR_BITS = 9;

/**
 * 2^15 = 32k
 */
const MAX_RECOMMENDED_BYTES_PER_CLUSTER_BITS = 15;

/**
 * @type {!Uint8Array}
 */
const OEM_NAME = str2bytes("LIBMNTJS");

/**
 * @type {!Uint8Array}
 */
const BOOT_ERROR_MESSAGE = str2bytes("Non-system disk or disk error\r\nreplace and strike any key when ready\r\n");

const MIN_RESERVED_SECTOR_COUNT = 1;
const MIN_RESERVED_SECTOR_COUNT_FAT32 = 32;

const FAT12 = 12;
const FAT16 = 16;
const FAT32 = 32;

/**
 * @type {!Uint8Array}
 */
const NO_NAME_SFN = str2bytes("NO NAME    ");

/**
 * https://web-archive.southampton.ac.uk/www.hpcc.ecs.soton.ac.uk/hpci/tools/floppy_disks.htm
 * https://web.archive.org/web/20150109055410/http://support.microsoft.com/kb/75131
 */
/**
 * @type {!Map<number, !Array<number>>}
 */
const FLOPPY_FORMATS = new Map([
  // capacity: Media, Tracks, NumHeads, SecPerTrk, SecPerClusBits, FATSz, RootDirSectors
  [160, [0xfe, 40, 1, 8, 0, 1, 4]],
  [180, [0xfc, 40, 1, 9, 0, 2, 4]],
  [320, [0xff, 40, 2, 8, 1, 1, 7]],
  [360, [0xfd, 40, 2, 9, 1, 2, 7]],
  [720, [0xf9, 80, 2, 9, 1, 3, 7]],
  [1200, [0xf9, 80, 2, 15, 0, 7, 14]],
  [1440, [0xf0, 80, 2, 18, 0, 9, 14]],
  [2880, [0xf0, 80, 2, 36, 1, 9, 15]],
]);

/**
 * @param {number} capacity
 * @param {string} [type]
 * @return {number}
 */
const getIndexBits = (capacity, type) => {
  let IndexBits = FAT32;
  if (type === "FAT12") {
    IndexBits = FAT12;
  } else if (type === "FAT16") {
    IndexBits = FAT16;
  } else if (type === "FAT32") {
    IndexBits = FAT32;
  } else if (capacity <= /* 4 MB */ 4 << 20) {
    IndexBits = FAT12;
  } else if (capacity < /* 512 MB */ 512 << 20) {
    IndexBits = FAT16;
  }
  // >= 512 MB
  return IndexBits;
};

/**
 * @param {number} min
 * @param {number} max
 * @param {number} defaultValue
 * @param {number} [value]
 * @return {number}
 */
const getIntegerOrDefault = (min, max, defaultValue, value) => {
  if (Number.isInteger(value)) {
    value = Number(value);
    if (value >= min && value <= max) {
      return value;
    }
  }
  return defaultValue;
};

/**
 * @return {number}
 */
const getDefaultVolID = () => {
  const now = new Date();
  return ((toDate(now) << 16) | toTime(now)) >>> 0;
};

/**
 * @param {number} CountOfClusters
 * @param {number} IndexBits
 * @param {number} BytsPerSecBits
 * @return {number}
 */
const getMinFATSz = (CountOfClusters, IndexBits, BytsPerSecBits) => {
  assert(CountOfClusters >= 0);
  assert(BytsPerSecBits >= 9);
  assert(IndexBits === FAT12 || IndexBits === FAT16 || IndexBits === FAT32);
  //
  //   FAT has to cover CountOfClusters + 2:
  //
  //   FATSz * BytsPerSec * 8 >= (CountOfClusters + 2) * IndexBits
  //   where SS is Sector Size in bytes, or
  //
  //               ┌─                                  ─┐
  //               │  (CountOfClusters + 2) * IndexBits │
  //   MinFATSz =  │ ────────────────────────────────── │
  //               │      1 << (BytsPerSecBits + 3)     │
  //
  const OriginalMinFATSz = Math.ceil(((CountOfClusters + 2) * IndexBits) / (1 << (BytsPerSecBits + 3)));
  // return OriginalMinFATSz;

  // Bit-shift Magic:
  let Dividend = CountOfClusters + 2;
  assert(Dividend <= 0x0fffffff);
  let DivisorShift = BytsPerSecBits + 3;
  if (IndexBits === FAT32) {
    DivisorShift -= 5;
  } else if (IndexBits === FAT16) {
    DivisorShift -= 4;
  } else {
    Dividend *= 3;
    DivisorShift -= 2;
  }

  assert(Dividend <= 0x3fffffff);
  assert(DivisorShift > 0);

  const Quotient = Dividend >>> DivisorShift;
  const Reminder = Dividend & ((1 << DivisorShift) - 1);
  const MinFATSz = Quotient + (Reminder === 0 ? 0 : 1);
  assert(MinFATSz === OriginalMinFATSz);
  return MinFATSz;

  // Closure Compiler output:
  //
  // function Ka(a, b) {
  //   a += 2;
  //   let c = 12;
  //   32 === b ? (c -= 5) : 16 === b ? (c -= 4) : ((a *= 3), (c -= 2));
  //   return (a >>> c) + (0 === (a & ((1 << c) - 1)) ? 0 : 1);
  // }
};

/**
 * @param {number} IndexBits
 * @param {number} DskSz
 * @param {number} MaxClusCntSafe
 * @param {number} BytsPerSecBits
 * @param {number} DataAndFAT
 * @param {number} NumFATs
 * @param {number} [secPerClus]
 * @return {number}
 */
const getSecPerClusBits = (IndexBits, DskSz, MaxClusCntSafe, BytsPerSecBits, DataAndFAT, NumFATs, secPerClus) => {
  if (Number.isInteger(secPerClus)) {
    const i = [1, 2, 4, 8, 16, 32, 64, 128].indexOf(Number(secPerClus));
    if (i >= 0) {
      return i;
    }
  }

  if (IndexBits === FAT32) {
    if (DskSz <= 260 << 11) {
      // disks up to 260 MB, 512 cluster
      return 0;
    }
    // 4k cluster
    return 3;
  }

  // find minimal sizeOfCluster
  const MaxFATSz = getMinFATSz(MaxClusCntSafe, IndexBits, BytsPerSecBits);
  const MinDataSec = DataAndFAT - NumFATs * MaxFATSz;
  const MaxSecPerClusBits = MAX_RECOMMENDED_BYTES_PER_CLUSTER_BITS - BytsPerSecBits;
  // SizeOfCluster = 2^(BytsPerSecBits + SecPerClusBits) <= 2^15 = 32768
  // or SecPerClusBits <= 15 - BytsPerSecBits = 6
  // SecPerClusBits is from 0 up to 6
  let SecPerClusBits = 0;
  let MaxDataSec = MaxClusCntSafe;
  while (SecPerClusBits < MaxSecPerClusBits && MaxDataSec < MinDataSec) {
    // even maximum number of clusters doesn't cover full DataSec: increase SecPerClus
    SecPerClusBits++;
    MaxDataSec *= 2;
  }
  return SecPerClusBits;
};

/**
 * @param {number} DataAndFAT
 * @param {number} NumFATs
 * @param {number} SecPerClusBits
 * @param {number} IndexBits
 * @param {number} BytsPerSecBits
 * @return {number}
 */
const getOptimalFATSz = (DataAndFAT, NumFATs, SecPerClusBits, IndexBits, BytsPerSecBits) => {
  /**
   * Algorithm to find FATSz
   *
   * Disk Layout: DskSz = RsvdSecCnt + FATSz * NumFATs + RootDirSectors + CountOfClusters * SecPerClus + Wasted
   * Find: Min(FATSz) maximizing CountOfClusters and minimizing wasted space
   *
   * (1) DskSz - RsvdSecCnt - FATSz * NumFATs - RootDirSectors - Wasted = CountOfClusters * SecPerClus
   * (2) FATSz * BytsPerSec * 8 >= (CountOfClusters + 2) * IndexBits
   *
   * Solution:
   *   FATSz * BytsPerSec * 8 * SecPerClus / IndexBits - 2 * SecPerClus >= CountOfClusters * SecPerClus
   *   FATSz * BytsPerSec * 8 * SecPerClus / IndexBits - 2 * SecPerClus >= DskSz - RsvdSecCnt - FATSz * NumFATs - RootDirSectors - Wasted
   *   FATSz * (BytsPerSec * 8 * SecPerClus / IndexBits + NumFATs) >= DskSz - RsvdSecCnt - RootDirSectors + 2 * SecPerClus - Wasted
   *
   *           ┌─                                                     ─┐
   *           │ DskSz - RsvdSecCnt - RootDirSectors + 2 * SecPerClus  │
   *   FATSz = │ ───────────────────────────────────────────────────── │
   *           │   BytsPerSec * 8 * SecPerClus / IndexBits + NumFATs   │
   *
   * This formula is identical to the formula on https://www.syslinux.org/archives/2016-February/024851.html:
   *
   *          ( To - Rs ) + ( 2 * Cs )
   *   Fs >= --------------------------
   *           ( Ss * Cs / Fe ) + Nf
   */
  const Numerator = DataAndFAT + (1 << (SecPerClusBits + 1));
  const Denominator = (1 << (SecPerClusBits + BytsPerSecBits + 3)) / IndexBits + NumFATs;
  return Math.ceil(Numerator / Denominator);
};

/**
 * @param {number} BytsPerSecBits
 * @param {number} [rootEntCnt]
 * @return {number}
 */
const getRootDirSectors = (BytsPerSecBits, rootEntCnt) => {
  const RootEntCnt = getIntegerOrDefault(1, 512, 512, rootEntCnt);
  const RootEntPerSecBits = BytsPerSecBits - DIR_ENTRY_SIZE_BITS;
  return (RootEntCnt >> RootEntPerSecBits) + ((RootEntCnt & ((1 << RootEntPerSecBits) - 1)) === 0 ? 0 : 1);
};

/**
 * @param {number} capacity
 * @param {!Array<number>} floppyFormat
 * @return {!DiskLayout}
 */
const createFloppyDiskLayout = (capacity, floppyFormat) => {
  const [Media, Tracks, NumHeads, SecPerTrk, SecPerClusBits, FATSz, RootDirSectors] = floppyFormat;
  const BytsPerSecBits = 9;
  const TotSec = Tracks * NumHeads * SecPerTrk;
  assert(TotSec << BytsPerSecBits === capacity);
  const RsvdSecCnt = 1;
  const NumFATs = 2;
  const MetaSec = RsvdSecCnt + FATSz * NumFATs + RootDirSectors;
  assert(MetaSec % (1 << SecPerClusBits) === 0);
  const DataSec = TotSec - MetaSec;
  const CountOfClusters = DataSec >> SecPerClusBits;
  return {
    IndexBits: FAT12,
    BytsPerSecBits,
    SecPerClusBits,
    RsvdSecCnt,
    NumFATs,
    RootDirSectors,
    FATSz,
    TotSec,
    CountOfClusters,
    Media,
    NumHeads,
    SecPerTrk,
  };
};

/**
 * Crazy Math
 * @param {number} capacity
 * @param {!ns.VFATOptions} [options]
 * @return {?DiskLayout}
 */
// eslint-disable-next-line max-lines-per-function
const createDiskLayout = (capacity, options) => {
  const maxCapacity = Number.MAX_SAFE_INTEGER;
  capacity = getIntegerOrDefault(0, maxCapacity, maxCapacity, capacity);
  const IndexBits = getIndexBits(capacity, options?.type);
  const BytsPerSecBits = BYTES_PER_SECTOR_BITS;
  const BytsPerSec = 1 << BytsPerSecBits;
  const DskSz = Math.min(MAX_DOUBLE_WORD, Math.floor(capacity / BytsPerSec));
  const NumFATs = options?.numFATs === 1 ? 1 : 2;
  let RootDirSectors = 0;
  let RsvdSecCnt = MIN_RESERVED_SECTOR_COUNT_FAT32;
  if (IndexBits !== FAT32) {
    RootDirSectors = getRootDirSectors(BytsPerSecBits, options?.rootEntCnt);
    RsvdSecCnt = MIN_RESERVED_SECTOR_COUNT;
  }

  let MinClusCntSafe = WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT32;
  let MaxClusCntSafe = WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT32;
  if (IndexBits === FAT12) {
    MinClusCntSafe = WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT12;
    MaxClusCntSafe = WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT12;
  } else if (IndexBits === FAT16) {
    MinClusCntSafe = WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT16;
    MaxClusCntSafe = WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT16;
  }

  const DataAndFAT = DskSz - RsvdSecCnt - RootDirSectors;
  if (DataAndFAT < NumFATs) {
    // Not enough capacity
    return null;
  }
  const compat = getIntegerOrDefault(0, COUNT_OF_CLUSTERS_COMPATIBILITY, COUNT_OF_CLUSTERS_COMPATIBILITY, options?.compat);
  MinClusCntSafe += compat;
  MaxClusCntSafe -= compat;
  const SecPerClusBits = getSecPerClusBits(IndexBits, DskSz, MaxClusCntSafe, BytsPerSecBits, DataAndFAT, NumFATs, options?.secPerClus);
  const SecPerClus = 1 << SecPerClusBits;
  let FATSz = getOptimalFATSz(DataAndFAT, NumFATs, SecPerClusBits, IndexBits, BytsPerSecBits);
  let DataSec = DataAndFAT - FATSz * NumFATs;
  let CountOfClusters = Math.floor(DataSec / SecPerClus);

  // limit number of clusters
  if (CountOfClusters < MinClusCntSafe) {
    // Not enough clusters
    return null;
  }
  if (CountOfClusters > MaxClusCntSafe) {
    CountOfClusters = MaxClusCntSafe;
  }

  // re-calculate
  FATSz = getMinFATSz(CountOfClusters, IndexBits, BytsPerSecBits);
  let MetaSec = RsvdSecCnt + FATSz * NumFATs + RootDirSectors;
  DataSec = CountOfClusters * SecPerClus;
  let TotSec = MetaSec + DataSec;
  let Wasted = DskSz - TotSec;
  assert(Wasted >= 0);

  // apply alignment
  const Reminder = MetaSec % SecPerClus;
  const Alignment = Reminder === 0 ? 0 : SecPerClus - Reminder;

  // take alignment from Wasted or from DataSec if Wasted is not enough
  let AlignmentAsjustment = 0;
  if (Alignment > Wasted) {
    CountOfClusters--;
    Wasted += SecPerClus;
    if (CountOfClusters < MinClusCntSafe) {
      // Not enough clusters
      return null;
    }
    // if FATSz is reduced we increase the Alignment
    const NewFATSz = getMinFATSz(CountOfClusters, IndexBits, BytsPerSecBits);
    AlignmentAsjustment = (FATSz - NewFATSz) * NumFATs;
    assert(AlignmentAsjustment >= 0);
    FATSz = NewFATSz;
  }

  Wasted -= Alignment;
  assert(Wasted >= 0);
  RsvdSecCnt += Alignment + AlignmentAsjustment;
  TotSec = DskSz - Wasted;
  assert(TotSec <= MAX_DOUBLE_WORD);

  // sanity checks
  MetaSec = RsvdSecCnt + FATSz * NumFATs + RootDirSectors;
  DataSec = CountOfClusters * SecPerClus;
  assert(MetaSec % SecPerClus === 0);
  assert(TotSec === MetaSec + DataSec);

  // console.log(
  //   `FAT${IndexBits}: ${DskSz * BytsPerSec} / ${BytsPerSec} = ${DskSz} = ${RsvdSecCntAligned} RsvdSecCnt + ${FATSz} FATSz * ${NumFATs} NumFATs + ${RootDirSectors} RootDirSectors + ${CountOfClusters} CountOfClusters * ${SecPerClus} SecPerClus + ${Wasted} Wasted`,
  // );

  return {
    IndexBits,
    BytsPerSecBits,
    SecPerClusBits,
    RsvdSecCnt,
    NumFATs,
    RootDirSectors,
    FATSz,
    TotSec,
    CountOfClusters,
    Media: 0xf8,
    NumHeads: 255,
    SecPerTrk: 63,
  };
};

/**
 * @param {!DiskLayout} diskLayout
 * @param {!ns.VFATOptions} [options]
 * @return {!BootSector}
 */
const createBootSector = (diskLayout, options) => {
  const { IndexBits, BytsPerSecBits, SecPerClusBits, RsvdSecCnt, NumFATs, RootDirSectors, FATSz, TotSec } = diskLayout;
  const bpbFat32 = IndexBits === FAT32;
  const BootCodeLength = bpbFat32 ? BS_BOOT_CODE_FAT32_LENGTH : BS_BOOT_CODE_LENGTH;
  const BytsPerSec = 1 << BytsPerSecBits;
  const RootEntCnt = RootDirSectors << (BytsPerSecBits - DIR_ENTRY_SIZE_BITS);

  /**
   * @type {!BootSector}
   */
  const bootSector = {
    jmpBoot: new Uint8Array(BS_JUMP_BOOT_LENGTH),
    OEMName: new Uint8Array(BS_OEM_NAME_LENGTH).fill(" ".charCodeAt(0)),
    bpb: {
      BytsPerSec,
      SecPerClus: 1 << SecPerClusBits,
      RsvdSecCnt,
      NumFATs,
      RootEntCnt,
      TotSec16: TotSec > MAX_WORD ? 0 : TotSec,
      Media: getIntegerOrDefault(0, MAX_BYTE, diskLayout.Media, options?.media),
      FATSz16: bpbFat32 ? 0 : FATSz,
      SecPerTrk: getIntegerOrDefault(0, MAX_WORD, diskLayout.SecPerTrk, options?.secPerTrk),
      NumHeads: getIntegerOrDefault(0, MAX_WORD, diskLayout.NumHeads, options?.numHeads),
      HiddSec: getIntegerOrDefault(0, MAX_DOUBLE_WORD, 0, options?.hiddSec),
      TotSec32: TotSec > MAX_WORD ? TotSec : 0,
      FATSz32: FATSz,
      ExtFlags: 0,
      FSVer: 0,
      RootClus: 2,
      FSInfo: 1,
      BkBootSec: 6,
    },
    DrvNum: 0,
    Reserved1: 0,
    BootSig: 0x29,
    VolID: getIntegerOrDefault(0, MAX_DOUBLE_WORD, getDefaultVolID(), options?.id),
    VolLab: NO_NAME_SFN,
    FilSysType: new Uint8Array(BS_FIL_SYS_TYPE_LENGTH).fill(" ".charCodeAt(0)),
    BootCode: new Uint8Array(BootCodeLength),
  };

  bootSector.OEMName.set((options?.oemName ?? OEM_NAME).subarray(0, BS_OEM_NAME_LENGTH));
  bootSector.FilSysType.set(str2bytes("FAT" + IndexBits));

  const bs = options?.bs;
  if (bs && bs.length >= 512) {
    bootSector.jmpBoot.set(bs.subarray(0, BS_JUMP_BOOT_LENGTH));
    bootSector.BootCode.set(bs.subarray(510 - BootCodeLength, 510));
  } else {
    let jmpBoot = jmpBoot12;
    let BootCode = BootCode12;
    const BootCodeOffset = 510 - BootCodeLength;
    if (bpbFat32) {
      jmpBoot = jmpBoot32;
      BootCode = BootCode32;
    }
    bootSector.jmpBoot.set(jmpBoot);
    bootSector.BootCode.set(BootCode);
    const message = options?.message ?? BOOT_ERROR_MESSAGE;
    const maxMessageLength = 510 - 1 - BootCodeOffset - BootCode.length;
    bootSector.BootCode.set(message.subarray(0, maxMessageLength), BootCode.length);
  }

  return bootSector;
};

/**
 * @param {number} IndexBits
 * @param {!BootSector} bootSector
 * @param {!ns.VFATOptions} [options]
 * @return {!ns.DiskSectors}
 */
const createDiskSectors = (IndexBits, bootSector, options) => {
  const bpb = bootSector.bpb;
  const { BytsPerSec, SecPerClus, RsvdSecCnt, NumFATs, RootEntCnt, TotSec16, Media, FATSz16, TotSec32, FATSz32 } = bpb;
  const bpbFat32 = IndexBits === FAT32;
  const RootDirSectors = bpbFat32 ? 0 : Math.ceil((RootEntCnt << DIR_ENTRY_SIZE_BITS) / BytsPerSec);
  const FATSz = bpbFat32 ? FATSz32 : FATSz16;
  const TotSec = TotSec16 ? TotSec16 : TotSec32;
  const MetaSec = RsvdSecCnt + FATSz * NumFATs + RootDirSectors;
  const DataSec = TotSec - MetaSec;
  const CountOfClusters = Math.floor(DataSec / SecPerClus);

  /**
   * @type {!Array<!ns.ZeroRegion>}
   */
  const zeroRegions = [];
  zeroRegions.push({ i: 0, count: MetaSec + (bpbFat32 ? SecPerClus : 0) });

  /**
   * @type {!Array<!ns.DataSector>}
   */
  const dataSectors = [];

  // boot sector
  const bs = new Uint8Array(BytsPerSec);
  writeBootSector(createIO(bs), bootSector);
  dataSectors.push({ i: 0, data: bs });

  // first sector of FAT with FAT[0] and FAT[1]
  const fat = new Uint8Array(BytsPerSec);
  fat[0] = Media;
  for (let j = 0; j < IndexBits / 4 - 1; j++) {
    fat[j + 1] = 0xff;
  }

  if (bpbFat32) {
    // add FAT32-specific sectors
    const { RootClus, FSInfo, BkBootSec } = bpb;

    // allocate RootClus
    const offset = RootClus * 4;
    fat[offset] = 0xff;
    fat[offset + 1] = 0xff;
    fat[offset + 2] = 0xff;
    fat[offset + 3] = 0x0f;

    const fsi = new Uint8Array(BytsPerSec);
    writeFSI(createIO(fsi), { FreeCount: CountOfClusters - 1, NxtFree: MIN_CLUS_NUM });
    dataSectors.push({ i: FSInfo, data: fsi });
    dataSectors.push({ i: BkBootSec, data: bs });
    dataSectors.push({ i: BkBootSec + 1, data: fsi });
  }

  for (let i = 0; i < NumFATs; i++) {
    const offset = RsvdSecCnt + i * FATSz;
    dataSectors.push({ i: offset, data: fat });
  }

  if (options?.label) {
    // first root directory sector with the label
    const root = new Uint8Array(BytsPerSec);
    const RootDirSec = RsvdSecCnt + FATSz * NumFATs + (bpbFat32 ? (bpb.RootClus - MIN_CLUS_NUM) * SecPerClus : 0);
    const sfn = new Uint8Array(DIR_NAME_LENGTH).fill(" ".charCodeAt(0));
    sfn.set(options.label.subarray(0, DIR_NAME_LENGTH));
    writeDirEntry(createIO(root), 0, createVolumeDirEntry(sfn));
    dataSectors.push({ i: RootDirSec, data: root });
  }

  return {
    bytsPerSec: BytsPerSec,
    zeroRegions,
    dataSectors,
  };
};

/**
 * @param {number} capacity
 * @param {!ns.VFATOptions} [options]
 * @return {?ns.VFATResult}
 */
export const mkfsvfat = (capacity, options) => {
  /**
   * @type {?Array<number> | undefined}
   */
  const floppyFormat = FLOPPY_FORMATS.get(capacity / 1024);
  const diskLayout = floppyFormat ? createFloppyDiskLayout(capacity, floppyFormat) : createDiskLayout(capacity, options);
  if (!diskLayout) {
    return null;
  }

  const { IndexBits, BytsPerSecBits, SecPerClusBits, RsvdSecCnt, NumFATs, RootDirSectors, FATSz, TotSec, CountOfClusters } = diskLayout;
  const bootSector = createBootSector(diskLayout, options);
  const sectors = createDiskSectors(IndexBits, bootSector, options);

  return {
    sectors,
    id: bootSector.VolID,
    type: "FAT" + IndexBits,
    totSec: TotSec,
    rsvdSecCnt: RsvdSecCnt,
    numFATs: NumFATs,
    fatSz: FATSz,
    rootDirSectors: RootDirSectors,
    countOfClusters: CountOfClusters,
    secPerClus: 1 << SecPerClusBits,
    bytsPerSec: 1 << BytsPerSecBits,
  };
};
