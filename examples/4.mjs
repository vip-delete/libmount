import { mkfsvfat } from "../src/index.mjs";
// import { mkfsvfat } from "libmount";

// http://www.syslinux.org/archives/2016-February/024850.html

const ss = 512;

// FAT32: 2143797248 / 512 = 4187104 = 66 RsvdSecCnt + 511 FATSz * 2 NumFATs + 0 RootDirSectors + 65406 CountOfClusters * 64 SecPerClus + 32 Wasted
const f0 = mkfsvfat(4187104 * ss, { numFATs: 2, secPerClus: 64 });
console.log(f0);
/**
{
  sectors: {...},
  id: ...,
  type: 'FAT32',
  totSec: 4187072,
  rsvdSecCnt: 66,
  numFATs: 2,
  fatSz: 511,
  rootDirSectors: 0,
  countOfClusters: 65406,
  secPerClus: 64,
  bytsPerSec: 512,
}
 */

// FAT32: 100029193728 / 512 = 195369519 = 58 RsvdSecCnt + 23843 FATSz * 2 NumFATs + 0 RootDirSectors + 3051902 CountOfClusters * 64 SecPerClus + 47 Wasted
const f1 = mkfsvfat(195369519 * ss, { numFATs: 2, secPerClus: 64 });
console.log(f1);
/**
{
  sectors: {...},
  id: ...,
  type: 'FAT32',
  totSec: 195369472,
  rsvdSecCnt: 58,
  numFATs: 2,
  fatSz: 23843,
  rootDirSectors: 0,
  countOfClusters: 3051902,
  secPerClus: 64,
  bytsPerSec: 512,
}
 */

// FAT32: 100029169664 / 512 = 195369472 = 58 RsvdSecCnt + 23843 FATSz * 2 NumFATs + 0 RootDirSectors + 3051902 CountOfClusters * 64 SecPerClus + 0 Wasted
const f2 = mkfsvfat(195369472 * ss, { numFATs: 2, secPerClus: 64 });
console.log(f2);
/**
{
  sectors: {...},
  id: ...,
  type: 'FAT32',
  totSec: 195369472,
  rsvdSecCnt: 58,
  numFATs: 2,
  fatSz: 23843,
  rootDirSectors: 0,
  countOfClusters: 3051902,
  secPerClus: 64,
  bytsPerSec: 512,
}
 */
