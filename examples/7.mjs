import { writeFileSync } from "../scripts/commons.mjs";
import { mkfsvfat, mount } from "../src/index.mjs";
// import { mkfsvfat, mount } from "libmount";

// Create 720K floppy disk image.
const capacityInBytes = 720 * 1024;

// FAT12: 737,280 / 512 = 1440 = 1 RsvdSecCnt + 3 FATSz * 2 NumFATs + 7 RootDirSectors + 713 CountOfClusters * 2 SecPerClus + 0 Wasted
const f0 = mkfsvfat(capacityInBytes);
if (!f0) {
  throw new Error();
}
console.log(f0);
/**
{
  sectors: {...},
  id: ...,
  type: 'FAT12',
  totSec: 1440,
  rsvdSecCnt: 1,
  numFATs: 2,
  fatSz: 3,
  rootDirSectors: 7,
  countOfClusters: 713,
  secPerClus: 2,
  bytsPerSec: 512,
}
 */
const { type, totSec, rsvdSecCnt, rootDirSectors, numFATs, fatSz } = f0;
const wastedBytes = capacityInBytes - 512 * totSec;
console.log(`Wasted: ${wastedBytes}`); // 0

const length = 512 * (rsvdSecCnt + numFATs * fatSz + rootDirSectors + (type === "FAT32" ? f0.secPerClus : 0));
const img = new Uint8Array(length);
mount(img).write(f0.sectors);

// write this image at the beginning of the disk
writeFileSync(`temp/Floppy-720K.img`, img);
