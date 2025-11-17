import { fdisk, mkfsvfat, mount } from "libmount";
import { expect, test } from "vitest";
import { COUNT_OF_CLUSTERS_COMPATIBILITY, LFN_MAX_LEN, WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT12, WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT16 } from "../src/const.mjs";
import { latin1 } from "../src/latin1.mjs";

const SzBits = 9;
const Sz = 1 << SzBits;

// 512 sector size, 1 RsvdSecCnt, 2 NumFATs, 512 RootEntCnt, default compatibility
const FAT12_DEFAULT_EDGES = [50, 4119, 8181, 16305, 32553, 65049, 130041];
// Disk Size              5k |   2M |  4M |   8M |  16M |  32M |   64M |  128M |  > 256M
// Cluster Size    Too Small ┘ 0.5k ┘  1k ┘   2k ┘   4k ┘   8k ┘   16k ┘   32k ┘  32k + Wasted Space

// 512 sector size, 1 RsvdSecCnt, 2 NumFATs, 512 RootEntCnt, default compatibility
const FAT16_DEFAULT_EDGES = [4169, 66047, 131549, 262553, 524561, 1048577, 2096609];
// Disk Size              2M |     32M |   64M |  128M |  256M |   512M |     1G |   2G | > 2G
// Cluster Size    Too Small ┘    0.5k ┘    1k ┘    2k ┘    4k ┘     8k ┘    16k ┘  32k ┘  32k + Wasted Space

const FLOPPY_SIZES = [160, 180, 320, 360, 720, 1200, 1440, 2880];

const MaxClusFAT12 = WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT12 - COUNT_OF_CLUSTERS_COMPATIBILITY;
const MaxClusFAT16 = WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT16 - COUNT_OF_CLUSTERS_COMPATIBILITY;

// /**
//  * @param {string} type
//  * @param {number} capacity
//  * @return {!Array<number>}
//  */
// const findEdgeCases = (type, capacity) => {
//   let secPerClus = -1;
//   const edges = [];
//   for (let i = 1; i < Math.floor(capacity / Sz); i++) {
//     if (!FLOPPY_SIZES.includes((i * Sz) / 1024)) {
//       const r = mkfsvfat(i * Sz, { type });
//       if (r) {
//         if (r.secPerClus > secPerClus) {
//           edges.push(i - 1);
//           secPerClus = r.secPerClus;
//         } else {
//           expect(r.secPerClus).toBe(secPerClus);
//         }
//       } else {
//         expect(secPerClus).toBe(-1);
//       }
//     }
//   }
//   console.log(edges);
//   return edges;
// };

/**
 * @param {string} type
 * @param {number} MaxCountOfClusters
 * @param {!Array<number>} edges
 */
const testEdgeCases = (type, MaxCountOfClusters, edges) => {
  for (let i = 1; i < edges.length; i++) {
    const cnt = edges[i];
    const secPerClus = 1 << (i - 1);
    const secPerClus2x = 2 * secPerClus;

    const fs1 = mkfsvfat(cnt * Sz, { type });
    expect(fs1).not.toBeNull();
    if (fs1) {
      expect(fs1.type).toBe(type);
      expect(cnt - fs1.totSec).toBeLessThanOrEqual(secPerClus);
      // expect(a.rsvdSecCnt).toBe(1);
      expect(fs1.secPerClus).toBe(secPerClus);
      expect(MaxCountOfClusters - fs1.countOfClusters).toBeLessThanOrEqual(secPerClus);
      expect(fs1.rootDirSectors).toBe(32);
      expect(fs1.numFATs).toBe(2);
    }

    const fs2 = mkfsvfat(cnt * Sz + Sz, { type });
    expect(fs2).not.toBeNull();
    if (fs2) {
      expect(fs2.type).toBe(type);
      const wasted = cnt + 1 - fs2.totSec;
      expect(wasted).toBeLessThan(secPerClus2x);
      // expect(b.rsvdSecCnt).toBe(1);
      expect(fs2.secPerClus).toBe(secPerClus2x);
      expect(fs2.rootDirSectors).toBe(32);
      expect(fs2.numFATs).toBe(2);
    }
  }
};

test("8GB-NumFATs-1", () => {
  const capacity = 8005787648;
  // FAT32: 8005787648 / 512 = 15636304 = 33 RsvdSecCnt + 15255 FATSz * 1 NumFATs + 0 RootDirSectors + 1952627 CountOfClusters * 8 SecPerClus + 0 Wasted
  const fs1 = mkfsvfat(capacity, { numFATs: 1, compat: 0 });
  expect(fs1).not.toBeNull();
  if (fs1) {
    expect(fs1.type).toBe("FAT32");
    expect(fs1.totSec).toBe(capacity / Sz);
    expect(fs1.rsvdSecCnt).toBe(33); // alignment
    expect(fs1.secPerClus).toBe(8);
    expect(fs1.countOfClusters).toBe(1952627);
    expect(fs1.rootDirSectors).toBe(0);
    expect(fs1.numFATs).toBe(1);
    expect(fs1.fatSz).toBe(15255);
  }
});

test("8GB-NumFATs-2", () => {
  const capacity = 8005787648;
  // FAT32: 8005787648 / 512 = 15636304 = 38 RsvdSecCnt + 15241 FATSz * 2 NumFATs + 0 RootDirSectors + 1950723 CountOfClusters * 8 SecPerClus + 0 Wasted
  const fs1 = mkfsvfat(capacity, { numFATs: 2, compat: 0 });
  expect(fs1).not.toBeNull();
  if (fs1) {
    expect(fs1.type).toBe("FAT32");
    expect(fs1.totSec).toBe(capacity / Sz);
    expect(fs1.rsvdSecCnt).toBe(38); // alignment
    expect(fs1.secPerClus).toBe(8);
    expect(fs1.countOfClusters).toBe(1950723);
    expect(fs1.rootDirSectors).toBe(0);
    expect(fs1.numFATs).toBe(2);
    expect(fs1.fatSz).toBe(15241);
  }
});

test("FAT12-0", () => {
  const fs1 = mkfsvfat(0);
  expect(fs1).toBeNull();
});

test("FAT12-3", () => {
  const fs1 = mkfsvfat(512 * 3, { numFATs: 1, label: latin1.encode("FAT-1.5k"), rootEntCnt: 1, compat: 0 });
  expect(fs1).not.toBeNull();
  if (fs1) {
    const disk = mount(new Uint8Array(512 * 3));
    disk.write(fs1.sectors);
    const fs = disk.getFileSystem();
    expect(fs).not.toBeNull();
    if (fs) {
      expect(fs.getLabel()).toBe("FAT-1.5k");
      const file = fs.getRoot().makeFile("1.TXT");
      expect(file).not.toBeNull();
      expect(file?.open()?.writeData(new Uint8Array(1))).toBe(0); // not disk space
    }
  }
});

test("FAT12-min", () => {
  // Need at least 1 data sector: 0
  const r3 = mkfsvfat(18 * Sz, { type: "FAT12", numFATs: 1, rootEntCnt: 1 });
  expect(r3).toBeNull();

  // 2 KB: 2048 / 512 = 4 = 1 RsvdSecCnt + 1 FATSz * 1 NumFATs + 1 RootDirSectors + 1 CountOfClusters * 1 SecPerClus + 0 Wasted
  const r4 = mkfsvfat(19 * Sz, { type: "FAT12", numFATs: 1, rootEntCnt: 1 });
  expect(r4).not.toBeNull();
  if (r4) {
    expect(r4.type).toBe("FAT12");
    expect(r4.totSec).toBe(19);
    expect(r4.rsvdSecCnt).toBe(1);
    expect(r4.secPerClus).toBe(1);
    expect(r4.countOfClusters).toBe(COUNT_OF_CLUSTERS_COMPATIBILITY);
    expect(r4.rootDirSectors).toBe(1);
    expect(r4.numFATs).toBe(1);
    expect(r4.fatSz).toBe(1);

    const disk = mount(new Uint8Array(19 * Sz));
    disk.write(r4.sectors);

    const fs = disk.getFileSystem();
    expect(fs).not.toBeNull();
    if (fs) {
      expect(fs.getName()).toBe("FAT12");
      fs.setLabel("MY DISK LABEL");
      expect(fs.getLabel()).toBe("MY DISK LAB");
      fs.setLabel(null);
      expect(fs.getLabel()).toBe("NO NAME");
      const data = new TextEncoder().encode("Hello World!");
      fs.getRoot().makeFile("TEST.TXT")?.open()?.writeData(data);
      expect(fs.getRoot().getFile("TEST.TXT")?.open()?.readData()).toStrictEqual(data);
    }
  }
});

test("FAT12-max", () => {
  const fs1 = mkfsvfat(Number.MAX_SAFE_INTEGER, { type: "FAT12" });
  expect(fs1).not.toBeNull();
  if (fs1) {
    expect(fs1.type).toBe("FAT12");
    expect(fs1.rsvdSecCnt).toBe(8);
    expect(fs1.secPerClus).toBe(64);
    expect(fs1.countOfClusters).toBe(MaxClusFAT12);
    expect(fs1.rootDirSectors).toBe(32);
    expect(fs1.numFATs).toBe(2);
    expect(fs1.fatSz).toBe(12);
    const TotSec32k = 8 + 2 * 12 + 32 + (32768 * MaxClusFAT12) / Sz;
    expect(fs1.totSec).toBe(TotSec32k); // 260537*512 = ~127.2 MB
  }

  const fs2 = mkfsvfat(Number.MAX_SAFE_INTEGER, { type: "FAT12", secPerClus: 128 });
  expect(fs2).not.toBeNull();
  if (fs2) {
    expect(fs2.type).toBe("FAT12");
    expect(fs2.rsvdSecCnt).toBe(72);
    expect(fs2.secPerClus).toBe(128);
    expect(fs2.countOfClusters).toBe(MaxClusFAT12);
    expect(fs2.rootDirSectors).toBe(32);
    expect(fs2.numFATs).toBe(2);
    expect(fs2.fatSz).toBe(12);
    const TotSec64k = 72 + 2 * 12 + 32 + (65536 * MaxClusFAT12) / Sz;
    expect(fs2.totSec).toBe(TotSec64k); // 521017*512 = ~254.4 MB
  }
});

test("FAT16-max", () => {
  const fs1 = mkfsvfat(Number.MAX_SAFE_INTEGER, { type: "FAT16" });
  if (fs1) {
    expect(fs1).not.toBeNull();
    expect(fs1.type).toBe("FAT16");
    expect(fs1.totSec).toBe(4192704); // ~2 GB
    expect(fs1.rsvdSecCnt).toBe(32);
    expect(fs1.secPerClus).toBe(64);
    expect(fs1.countOfClusters).toBe(MaxClusFAT16);
    expect(fs1.rootDirSectors).toBe(32);
    expect(fs1.numFATs).toBe(2);
    expect(fs1.fatSz).toBe(256);
  }

  const fs2 = mkfsvfat(Number.MAX_SAFE_INTEGER, { type: "FAT16", secPerClus: 128 });
  expect(fs2).not.toBeNull();
  if (fs2) {
    expect(fs2.type).toBe("FAT16");
    expect(fs2.totSec).toBe(8384896); // ~4 GB
    expect(fs2.rsvdSecCnt).toBe(96);
    expect(fs2.secPerClus).toBe(128);
    expect(fs2.countOfClusters).toBe(MaxClusFAT16);
    expect(fs2.rootDirSectors).toBe(32);
    expect(fs2.numFATs).toBe(2);
    expect(fs2.fatSz).toBe(256);
  }
});

test("FAT32-260M", () => {
  const fs1 = mkfsvfat(260 << 20, { type: "FAT32" });
  expect(fs1).not.toBeNull();
  if (fs1) {
    expect(fs1.type).toBe("FAT32");
    expect(fs1.totSec).toBe(260 << 11);
    expect(fs1.rsvdSecCnt).toBe(32);
    expect(fs1.secPerClus).toBe(1);
    expect(fs1.countOfClusters).toBe(524256);
    expect(fs1.rootDirSectors).toBe(0);
    expect(fs1.numFATs).toBe(2);
    expect(fs1.fatSz).toBe(4096);

    const disk = mount(new Uint8Array(10 * 1024 * 1024));
    disk.write(fs1.sectors);
    const fs = disk.getFileSystem();
    expect(fs).not.toBeNull();
    if (fs) {
      expect(fs.getFreeClusters()).toBe(524255);
      for (let i = 0; i < 16 - 1; i++) {
        fs.getRoot().makeFile(i + ".TXT");
      }
      expect(fs.getFreeClusters()).toBe(524255);
      const maxName = "0".repeat(LFN_MAX_LEN);
      const file = fs.getRoot().makeFile(maxName);
      expect(file).not.toBeNull();
      const f1 = fs.getRoot().findFirst((it) => it.getName().startsWith("00"));
      expect(f1?.getName()).toBe(maxName);
      expect(fs.getFreeClusters()).toBe(524253);
    }
  }

  const fs2 = mkfsvfat((260 << 20) + Sz, { type: "FAT32" });
  expect(fs2).not.toBeNull();
  if (fs2) {
    expect(fs2.type).toBe("FAT32");
    expect(fs2.totSec).toBe(260 << 11);
    expect(fs2.rsvdSecCnt).toBe(34);
    expect(fs2.secPerClus).toBe(8);
    expect(fs2.countOfClusters).toBe(66426);
    expect(fs2.rootDirSectors).toBe(0);
    expect(fs2.numFATs).toBe(2);
    expect(fs2.fatSz).toBe(519);
  }
});

test("FAT32-32k", () => {
  const fs1 = mkfsvfat(Number.MAX_SAFE_INTEGER, { type: "FAT32", secPerClus: 64 });
  expect(fs1).not.toBeNull();
  if (fs1) {
    expect(fs1.type).toBe("FAT32");
    expect(fs1.totSec).toBe(4294967232);
    expect(fs1.rsvdSecCnt).toBe(62);
    expect(fs1.secPerClus).toBe(64);
    expect(fs1.countOfClusters).toBe(67092482);
    expect(fs1.rootDirSectors).toBe(0);
    expect(fs1.numFATs).toBe(2);
    expect(fs1.fatSz).toBe(524161);
  }
});

test("FAT32-64k", () => {
  const fs1 = mkfsvfat(Number.MAX_SAFE_INTEGER, { type: "FAT32", secPerClus: 128 });
  expect(fs1).not.toBeNull();
  if (fs1) {
    expect(fs1.type).toBe("FAT32");
    expect(fs1.totSec).toBe(4294967168);
    expect(fs1.rsvdSecCnt).toBe(62);
    expect(fs1.secPerClus).toBe(128);
    expect(fs1.countOfClusters).toBe(33550335);
    expect(fs1.rootDirSectors).toBe(0);
    expect(fs1.numFATs).toBe(2);
    expect(fs1.fatSz).toBe(262113);
  }
});

test("FAT32-2GB", () => {
  // https://www.syslinux.org/archives/2016-February/024859.html
  // (~2GB) FAT32: 2143797248 / 512 = 4187104 = 64 RsvdSecCnt + 511 FATSz * 2 NumFATs + 0 RootDirSectors + 65406 CountOfClusters * 64 SecPerClus + 34 Wasted
  const fs1 = mkfsvfat(2143797248, { type: "FAT32", secPerClus: 64 });
  expect(fs1).not.toBeNull();
  if (fs1) {
    expect(fs1.type).toBe("FAT32");
    expect(fs1.totSec).toBe(4187072);
    expect(fs1.rsvdSecCnt).toBe(66);
    expect(fs1.secPerClus).toBe(64);
    expect(fs1.countOfClusters).toBe(65406);
    expect(fs1.rootDirSectors).toBe(0);
    expect(fs1.numFATs).toBe(2);
    expect(fs1.fatSz).toBe(511);
  }
});

test("FAT32-93GB", () => {
  // http://www.syslinux.org/archives/2016-February/024850.html
  // (~93MB) FAT32: 100029193728 / 512 = 195369519 = 58 RsvdSecCnt + 23843 FATSz * 2 NumFATs + 0 RootDirSectors + 3051902 CountOfClusters * 64 SecPerClus + 47 Wasted
  const fs1 = mkfsvfat(100029193728, { type: "FAT32", secPerClus: 64 });
  expect(fs1).not.toBeNull();
  if (fs1) {
    expect(fs1.type).toBe("FAT32");
    expect(fs1.totSec).toBe(195369472);
    expect(fs1.rsvdSecCnt).toBe(58);
    expect(fs1.secPerClus).toBe(64);
    expect(fs1.countOfClusters).toBe(3051902);
    expect(fs1.rootDirSectors).toBe(0);
    expect(fs1.numFATs).toBe(2);
    expect(fs1.fatSz).toBe(23843);
  }
  // Same but without wasted sectors, we will get the same disk layout
  // FAT32: 100029169664 / 512 = 195369472 = 58 RsvdSecCnt + 23843 FATSz * 2 NumFATs + 0 RootDirSectors + 3051902 CountOfClusters * 64 SecPerClus + 0 Wasted
  const fs2 = mkfsvfat(100029169664, { type: "FAT32", secPerClus: 64 });
  expect(fs2).not.toBeNull();
  if (fs2) {
    expect(fs2.type).toBe("FAT32");
    expect(fs2.totSec).toBe(195369472);
    expect(fs2.rsvdSecCnt).toBe(58);
    expect(fs2.secPerClus).toBe(64);
    expect(fs2.countOfClusters).toBe(3051902);
    expect(fs2.rootDirSectors).toBe(0);
    expect(fs2.numFATs).toBe(2);
    expect(fs2.fatSz).toBe(23843);
  }
});

// test("FAT12/16-find-edge-cases", { timeout: Number.MAX_SAFE_INTEGER }, () => {
//   expect(findEdgeCases(mkfsvfat, "FAT12", 0x10000000)).toStrictEqual(FAT12_DEFAULT_EDGES);
//   expect(findEdgeCases(mkfsvfat, "FAT16", 0x80000000)).toStrictEqual(FAT16_DEFAULT_EDGES);
// });

test("FAT12/16-check-edge-cases", () => {
  testEdgeCases("FAT12", MaxClusFAT12, FAT12_DEFAULT_EDGES);
  testEdgeCases("FAT16", MaxClusFAT16, FAT16_DEFAULT_EDGES);
});

test("PartitionDisk-1", () => {
  const img = new Uint8Array(32768 * Sz); // 16M
  const disk = mount(img);

  // write partition table on disk
  disk.write(
    fdisk([
      {
        active: true,
        type: 1,
        relativeSectors: 1,
        totalSectors: 8192, // 4M partition
      },
      {
        active: false,
        type: 6,
        relativeSectors: 1 + 8192,
        totalSectors: 32768 - (1 + 8192),
      },
    ]),
  );

  const partitions = disk.getPartitions();
  expect(partitions.length).toBe(2);

  // mount 2 logical partitions
  const disk0 = mount(img, { partition: partitions[0] });
  const disk1 = mount(img, { partition: partitions[1] });
  expect(disk0.capacity()).toBe(Sz * 8192);
  expect(disk1.capacity()).toBe(Sz * (32768 - (1 + 8192)));

  const f0 = mkfsvfat(disk0.capacity());
  expect(f0).not.toBeNull();
  if (f0) {
    expect(f0.countOfClusters).toBe(2036);

    // write file system on first partition
    disk0.write(f0.sectors);
    const fs0 = disk0.getFileSystem();
    expect(fs0).not.toBeNull();
    if (fs0) {
      expect(fs0.getName()).toBe("FAT12");
      expect(fs0.getFreeClusters()).toBe(f0.countOfClusters);
      expect(fs0.getSizeOfCluster()).toBe(2048);

      const file = fs0.getRoot().makeFile("/DEMO/hello world.txt");
      expect(file?.getShortName()).toBe("HELLO ~1.TXT");
      file?.open()?.writeData(latin1.encode("Hello World!"));
      expect(file?.length()).toBe(12);
    }
  }

  const f1 = mkfsvfat(disk1.capacity());
  expect(f1).not.toBeNull();
  if (f1) {
    expect(f1.countOfClusters).toBe(24350);

    // write file system on second partition
    disk1.write(f1.sectors);
    const fs1 = disk1.getFileSystem();
    expect(fs1).not.toBeNull();
    if (fs1) {
      expect(fs1.getName()).toBe("FAT16");
      expect(fs1.getFreeClusters()).toBe(f1.countOfClusters);
      expect(fs1.getSizeOfCluster()).toBe(512);
      const file = fs1.getRoot().makeFile("/DEMO/hello world.txt");
      expect(file?.getShortName()).toBe("HELLO ~1.TXT");
      file?.open()?.writeData(latin1.encode("Hello World!"));
      expect(file?.length()).toBe(12);
    }
  }
});

test("PartitionDisk-2", () => {
  const realCapacity = 65536; // 32M
  const offset = 2048; // 1M
  const capacity = 195369519; // ~93G
  const img = new Uint8Array(realCapacity * Sz);
  const disk = mount(img);
  const partition = {
    active: false,
    type: 6,
    relativeSectors: offset,
    totalSectors: capacity,
  };
  disk.write(fdisk([partition]));
  const partitions = disk.getPartitions();
  expect(partitions.length).toBe(1);
  expect(partitions[0]).toStrictEqual(partition);

  const disk0 = mount(img, { partition: partitions[0] });
  expect(disk0.capacity()).toBe(partition.totalSectors * Sz);
  // (~93MB) FAT32: 100029193728 / 512 = 195369519 = 58 RsvdSecCnt + 23843 FATSz * 2 NumFATs + 0 RootDirSectors + 3051902 CountOfClusters * 64 SecPerClus + 47 Wasted
  const file = mkfsvfat(capacity * Sz, { secPerClus: 64, label: latin1.encode("FAT32-23843") });
  expect(file).not.toBeNull();
  if (file) {
    expect(file.type).toBe("FAT32");
    expect(file.totSec).toBe(195369472);
    expect(file.rsvdSecCnt).toBe(58);
    expect(file.secPerClus).toBe(64);
    expect(file.countOfClusters).toBe(3051902);
    expect(file.rootDirSectors).toBe(0);
    expect(file.numFATs).toBe(2);
    expect(file.fatSz).toBe(23843);
    expect((file.rsvdSecCnt + file.numFATs * file.fatSz) % file.secPerClus === 0);

    // write filesystem on first partition
    disk0.write(file.sectors);
  }

  const fs = mount(img, { partition: partitions[0] }).getFileSystem();
  expect(fs).not.toBeNull();
  if (fs) {
    expect(fs.getName()).toBe("FAT32");
    expect(fs.getOEMName()).toBe("LIBMNTJS");
    expect(fs.getLabel()).toBe("FAT32-23843");
    expect(fs.getCountOfClusters()).toBe(3051902);
    expect(fs.getSizeOfCluster()).toBe(32768);
    expect(fs.getFreeClusters()).toBe(fs.getCountOfClusters() - 1); // -1 for RootClus
    expect(fs.getId()).toBe(file?.id);
  }
});

test("floppies", () => {
  for (const capacity of FLOPPY_SIZES) {
    const fs1 = mkfsvfat(capacity * 1024);
    expect(fs1).not.toBeNull();
  }
});
