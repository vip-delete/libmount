import { expect, test } from "vitest";
import { readBinaryFileSync } from "../scripts/commons.mjs";
import { BS_BOOT_CODE_FAT32_LENGTH, DIR_ENTRY_SIZE, DIR_NAME_LENGTH } from "../src/const.mjs";
import { createVolumeDirEntry, loadBootSector, loadDirEntry, loadPartitionTable, writeDirEntry, writePartitionTable } from "../src/dao.mjs";
import { createIO } from "../src/io.mjs";
import { latin1 } from "../src/latin1.mjs";
import { PartitionEntry } from "../src/types.mjs";
import { chs2lba, lba2chs } from "../src/utils.mjs";

test("chs2lba", () => {
  const TH = 255;
  const TS = 63;

  const startingCHS = {
    Cylinder: 0,
    Head: 1,
    Sector: 1,
  };

  const endingCHS = {
    Cylinder: 0x391,
    Head: 0x1f,
    Sector: 0x3f,
  };

  const startingLBA = chs2lba(startingCHS, TH, TS);
  expect(startingLBA).toBe(63);

  const endingLBA = chs2lba(endingCHS, TH, TS);
  expect(endingLBA).toBe(14669360);

  expect(lba2chs(startingLBA, TH, TS)).toStrictEqual(startingCHS);
  expect(lba2chs(endingLBA, TH, TS)).toStrictEqual(endingCHS);
});

test("partitions-1", () => {
  const raw = new Uint8Array(512);
  raw.set([0x80, 0x01, 0x01, 0x00, 0x0e, 0x0f, 0xff, 0x91, 0x3f, 0x00, 0x00, 0x00, 0xa1, 0x0e, 0x0e, 0x00], 510 - 16 * 4);
  raw.set([0x55, 0xaa], 510);
  const table = loadPartitionTable(createIO(raw));
  /**
   * @type {!Array<!PartitionEntry>}
   */
  const expected = [
    {
      BootIndicator: 0x80,
      Starting: {
        Cylinder: 0,
        Head: 1,
        Sector: 1,
      },
      SystemID: 0x0e,
      Ending: {
        Cylinder: 0x391,
        Head: 0xf,
        Sector: 0x3f,
      },
      RelativeSectors: 0x3f,
      TotalSectors: 0xe0ea1,
    },
  ];
  expect(table).toStrictEqual(expected);
  const newRaw = new Uint8Array(512);
  writePartitionTable(createIO(newRaw), table);
  expect(newRaw).toStrictEqual(raw);
});

test("partitions-2", () => {
  const raw = new Uint8Array(512);
  raw.set([0x80, 0x01, 0x01, 0x00, 0x0b, 0x1f, 0xff, 0x27, 0x3f, 0x00, 0x00, 0x00, 0xc1, 0xda, 0x18, 0x00], 510 - 16 * 4);
  raw.set([0x55, 0xaa], 510);
  const table = loadPartitionTable(createIO(raw));
  /**
   * @type {!Array<!PartitionEntry>}
   */
  const expected = [
    {
      BootIndicator: 0x80,
      Starting: {
        Cylinder: 0,
        Head: 1,
        Sector: 1,
      },
      SystemID: 0x0b,
      Ending: {
        Cylinder: 0x327,
        Head: 0x1f,
        Sector: 0x3f,
      },
      RelativeSectors: 0x3f,
      TotalSectors: 0x18dac1,
    },
  ];
  expect(table).toStrictEqual(expected);
  const newRaw = new Uint8Array(512);
  writePartitionTable(createIO(newRaw), table);
  expect(newRaw).toStrictEqual(raw);
});

test("bs-1", () => {
  const img = new Uint8Array(readBinaryFileSync("tests/images/fat32.img"));
  const io = createIO(img);
  const bs = loadBootSector(io);
  expect(bs.jmpBoot).toStrictEqual(new Uint8Array([0xeb, 0x58, 0x90]));
  expect(latin1.decode(bs.OEMName)).toBe("MSDOS5.0");
  expect(bs.DrvNum).toBe(0x80);
  expect(bs.Reserved1).toBe(0);
  expect(bs.BootSig).toBe(0x29);
  expect(bs.VolID).toBe(0x50074f94);
  expect(latin1.decode(bs.VolLab)).toBe("NO NAME    ");
  expect(latin1.decode(bs.FilSysType)).toBe("FAT32   ");
  expect(bs.BootCode.length).toBe(BS_BOOT_CODE_FAT32_LENGTH);

  // System Area: 2292 + 2 * 15238 = 32768
  // Disk Layout: 15636304 = 2292 + 2 * 15238 + 8 * 1950442
  const bpb = bs.bpb;
  expect(bpb.BytsPerSec).toBe(512);
  expect(bpb.SecPerClus).toBe(8); // 4k cluster
  expect(bpb.RsvdSecCnt).toBe(2292); // alignment
  expect(bpb.NumFATs).toBe(2);
  expect(bpb.RootEntCnt).toBe(0);
  expect(bpb.TotSec16).toBe(0);
  expect(bpb.Media).toBe(0xf8);
  expect(bpb.FATSz16).toBe(0);
  expect(bpb.SecPerTrk).toBe(63);
  expect(bpb.NumHeads).toBe(255);
  expect(bpb.HiddSec).toBe(0);
  expect(bpb.TotSec32).toBe(15636304);
  expect(bpb.FATSz32).toBe(15238);
  expect(bpb.ExtFlags).toBe(0);
  expect(bpb.FSVer).toBe(0);
  expect(bpb.RootClus).toBe(2);
  expect(bpb.FSInfo).toBe(1);
  expect(bpb.BkBootSec).toBe(6);
});

test("bs-2", () => {
  const img = new Uint8Array(readBinaryFileSync("tests/images/bs-23843.img"));
  const io = createIO(img);
  const bs = loadBootSector(io);
  expect(bs.jmpBoot).toStrictEqual(new Uint8Array([0xeb, 0x48, 0x90]));
  expect(latin1.decode(bs.OEMName)).toBe("LIBMOUNT");
  expect(bs.DrvNum).toBe(0);
  expect(bs.Reserved1).toBe(0);
  expect(bs.BootSig).toBe(0x29);
  expect(bs.VolID).toBe(0x5a526595);
  expect(latin1.decode(bs.VolLab)).toBe("NO NAME    ");
  expect(latin1.decode(bs.FilSysType)).toBe("FAT32   ");
  expect(bs.BootCode.length).toBe(BS_BOOT_CODE_FAT32_LENGTH);

  const bpb = bs.bpb;
  expect(bpb.BytsPerSec).toBe(512);
  expect(bpb.SecPerClus).toBe(64); // 4k cluster
  expect(bpb.RsvdSecCnt).toBe(58); // 32 + alignment
  expect(bpb.NumFATs).toBe(2);
  expect(bpb.RootEntCnt).toBe(0);
  expect(bpb.TotSec16).toBe(0);
  expect(bpb.Media).toBe(0xf8);
  expect(bpb.FATSz16).toBe(0);
  expect(bpb.SecPerTrk).toBe(63);
  expect(bpb.NumHeads).toBe(255);
  expect(bpb.HiddSec).toBe(0);
  expect(bpb.TotSec32).toBe(195369472);
  expect(bpb.FATSz32).toBe(23843);
  expect(bpb.ExtFlags).toBe(0);
  expect(bpb.FSVer).toBe(0);
  expect(bpb.RootClus).toBe(2);
  expect(bpb.FSInfo).toBe(1);
  expect(bpb.BkBootSec).toBe(6);
});

test("E5", () => {
  const img = new Uint8Array(DIR_ENTRY_SIZE);
  const io = createIO(img);
  const dirEntry = createVolumeDirEntry(new Uint8Array(DIR_NAME_LENGTH).fill(0xe5));
  writeDirEntry(io, 0, dirEntry);
  expect(img[0]).toBe(0x05);
  io.seek(0);
  expect(loadDirEntry(io).Name[0]).toBe(0xe5);
});
