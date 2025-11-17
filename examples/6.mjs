import { writeFileSync } from "../scripts/commons.mjs";
import { mkfsvfat, mount } from "../src/index.mjs";
// import { mkfsvfat, mount } from "libmount";

// Create 1.44MB floppy disk image.
const capacityInBytes = 1440 * 1024;

// FAT12: 1474560 / 512 = 2880 = 1 RsvdSecCnt + 9 FATSz * 2 NumFATs + 14 RootDirSectors + 2847 CountOfClusters * 1 SecPerClus + 0 Wasted
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
  totSec: 2880,
  rsvdSecCnt: 1,
  numFATs: 2,
  fatSz: 9,
  rootDirSectors: 14,
  countOfClusters: 2847,
  secPerClus: 1,
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
writeFileSync(`temp/Floppy-1440K.img`, img);
