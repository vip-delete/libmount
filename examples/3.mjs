import { mkdirSync, writeFileSync } from "../scripts/commons.mjs";
import { latin1 } from "../src/latin1.mjs";
import { mkfsvfat } from "../src/mkfsvfat.mjs";
import { mount } from "../src/mount.mjs";

mkdirSync("temp");

// Format 8GB flash disk with 4k clusters.
const capacityInBytes = 8005787648;

// Windows 10 formats this way:
// FAT32: 8005787648 / 512 = 15636304 = 2292 RsvdSecCnt + 15238 FATSz * 2 NumFATs + 1950442 CountOfClusters * 8 SecPerClus + 0 Wasted
// Data Area offset is 2292 + 15238*2 = 32768 which is aligned on cluster size (32768 % 8 = 0) but 2292 looks too much.

// LibMount formats this way:
// FAT32: 8005787648 / 512 = 15636304 = 33 RsvdSecCnt + 15255 FATSz * 1 NumFATs + 0 RootDirSectors + 1952627 CountOfClusters * 8 SecPerClus + 0 Wasted
// Data Area offset is 33 + 15255*1 = 15288 which is also aligned on cluster size (15288 % 8 = 0), but we have 2185 additional clusters (~8.5 MB)

const f0 = mkfsvfat(capacityInBytes, { numFATs: 1, label: latin1.encode("FLASH"), compat: 0 });
if (!f0) {
  throw new Error();
}
console.log(f0);
/**
{
  sectors: {...},
  id: ...,
  type: 'FAT32',
  totSec: 15636304,
  rsvdSecCnt: 33,
  numFATs: 1,
  fatSz: 15255,
  rootDirSectors: 0,
  countOfClusters: 1952627,
  secPerClus: 8,
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
writeFileSync(`temp/Flash-meta.img`, img);
