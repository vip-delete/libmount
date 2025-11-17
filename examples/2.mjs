import { mkdirSync, writeFileSync } from "../scripts/commons.mjs";
import {
  WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT12,
  WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT16,
  WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT32,
  WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT12,
  WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT16,
  WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT32,
} from "../src/const.mjs";
import { mkfsvfat, mount } from "../src/index.mjs";
import { latin1 } from "../src/latin1.mjs";
// import { mkfsvfat, mount } from "libmount";

mkdirSync("temp");

// Generate Disk Images.
const SZ = 512;

/**
 * Calculate the minimal volume capacity for the given number of clusters
 * @param {number} indexBits
 * @param {number} numFATs
 * @param {number} secPerClus
 * @param {number} countOfClusters
 * @returns {number}
 */
const getMinCapacity = (indexBits, numFATs, secPerClus, countOfClusters) => {
  const RsvdSecCnt = indexBits === 32 ? 32 : 1;
  const RootDirSectors = indexBits === 32 ? 0 : 1;
  const FATSz = Math.ceil(((countOfClusters + 2) * indexBits) / (8 * SZ));
  const SystemAreaUnAligned = RsvdSecCnt + numFATs * FATSz + RootDirSectors;
  const Reminder = SystemAreaUnAligned % secPerClus;
  const Alignment = Reminder === 0 ? 0 : secPerClus - Reminder;
  const MetaSec = SystemAreaUnAligned + Alignment;
  const DataSec = countOfClusters * secPerClus;
  const TotSec = MetaSec + DataSec;
  const capacity = SZ * TotSec;
  return capacity;
};

/**
 * Create an image with the given number of clusters
 * @param {string} label
 * @param {number} indexBits
 * @param {number} numFATs
 * @param {number} secPerClus
 * @param {number} countOfClusters
 * @param {boolean} [MetaSecOnly]
 */
const mkfs = (label, indexBits, numFATs, secPerClus, countOfClusters, MetaSecOnly) => {
  console.log(`Creating ${label}`);
  const capacity = getMinCapacity(indexBits, numFATs, secPerClus, countOfClusters);
  const f0 = mkfsvfat(capacity, { type: "FAT" + indexBits, label: latin1.encode(label), numFATs, compat: 0, secPerClus, rootEntCnt: 1 });
  if (!f0) {
    throw new Error();
  }

  const MetaSec = SZ * (f0.rsvdSecCnt + f0.numFATs * f0.fatSz + f0.rootDirSectors + (indexBits === 32 ? secPerClus : 0));
  const img = new Uint8Array(MetaSecOnly ? MetaSec : capacity);
  const disk = mount(img);
  disk.write(f0.sectors);

  const fs = disk.getFileSystem();
  if (!fs) {
    throw new Error();
  }

  console.log(`FileSystem: ${fs.getName()}, CountOfClusters: ${fs.getCountOfClusters()}, FreeClusters: ${fs.getFreeClusters()}`);

  const file = fs.getRoot().makeFile("HELLO.TXT");

  if (MetaSecOnly) {
    writeFileSync(`temp/${label}-meta.img`, img);
    return;
  }

  // fill all clusters
  const max = fs.getFreeClusters();
  const arr = new Array(max);
  for (let i = 0; i < max; i++) {
    const str = String(i + 1).padStart(15, " ") + "\n";
    arr[i] = str.repeat(32);
  }
  const data = new TextEncoder().encode(arr.join(""));
  file?.open()?.writeData(data);
  writeFileSync(`temp/${label}.img`, img);
};

// FAT12: 1536 / 512 = 3 = 1 RsvdSecCnt + 1 FATSz * 1 NumFATs + 1 RootDirSectors + 0 CountOfClusters * 1 SecPerClus + 0 Wasted
mkfs("F12-1.5k1S", 12, 1, 1, WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT12, true);

// FAT12: 2095104 / 512 = 4092 = 1 RsvdSecCnt + 12 FATSz * 1 NumFATs + 1 RootDirSectors + 4078 CountOfClusters * 1 SecPerClus + 0 Wasted
mkfs("F12-2M1S", 12, 1, 1, WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT12, true);

// FAT12: 267321344 / 512 = 522112 = 115 RsvdSecCnt + 12 FATSz * 1 NumFATs + 1 RootDirSectors + 4078 CountOfClusters * 128 SecPerClus + 0 Wasted
mkfs("F12-255M128S", 12, 1, 128, WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT12, true);

// FAT16: 2101760 / 512 = 4105 = 1 RsvdSecCnt + 16 FATSz * 1 NumFATs + 1 RootDirSectors + 4087 CountOfClusters * 1 SecPerClus + 0 Wasted
mkfs("F16-2M1S", 16, 1, 1, WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT16, true);

// FAT16: 33677312 / 512 = 65776 = 1 RsvdSecCnt + 256 FATSz * 1 NumFATs + 1 RootDirSectors + 65518 CountOfClusters * 1 SecPerClus + 0 Wasted
mkfs("F16-32M1S", 16, 1, 1, WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT16, true);

// FAT16: 4293984256 / 512 = 8386688 = 127 RsvdSecCnt + 256 FATSz * 1 NumFATs + 1 RootDirSectors + 65518 CountOfClusters * 128 SecPerClus + 0 Wasted
mkfs("F16-4G128S", 16, 1, 128, WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT16, true);

// FAT32: 17408 / 512 = 34 = 32 RsvdSecCnt + 1 FATSz * 1 NumFATs + 0 RootDirSectors + 1 CountOfClusters * 1 SecPerClus + 0 Wasted
mkfs("F32-17k1S", 32, 1, 1, WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT32, true);

// FAT32: 138512702464 / 512 = 270532622 = 32 RsvdSecCnt + 2097152 FATSz * 1 NumFATs + 0 RootDirSectors + 268435438 CountOfClusters * 1 SecPerClus + 0 Wasted
mkfs("F32-129G1S", 32, 1, 1, WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT32, true);

// FAT32: 2199023255040 / 512 = 4294967295 = 144 RsvdSecCnt + 262128 FATSz * 1 NumFATs + 0 RootDirSectors + 33552382 CountOfClusters * 128 SecPerClus + 127 Wasted
mkfs("F32-2T128S", 32, 1, 128, WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT32, true);

// https://www.syslinux.org/archives/2016-February/024859.html
// FAT32: 33765888 / 512 = 65949 = 32 RsvdSecCnt + 511 FATSz * 1 NumFATs + 0 RootDirSectors + 65406 CountOfClusters * 1 SecPerClus + 0 Wasted
mkfs("F32-32M1S", 32, 2, 1, 65406, false);

// https://www.syslinux.org/archives/2016-February/024846.html
// FAT32: 100029169664 / 512 = 195369472 = 58 RsvdSecCnt + 23843 FATSz * 2 NumFATs + 0 RootDirSectors + 3051902 CountOfClusters * 64 SecPerClus + 0 Wasted
mkfs("F32-93G64S", 32, 2, 64, 3051902, true);
