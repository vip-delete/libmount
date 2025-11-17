import { mount } from "libmount";
import { expect, test } from "vitest";
import { existsSync, readBinaryFileSync } from "../scripts/commons.mjs";
import { chs2lba, lba2chs } from "../src/utils.mjs";

const filename = "tests/images/windowsme.img";
const skip = !existsSync(filename);

const getWinMeFs = () => {
  const imgFile = readBinaryFileSync(filename);
  const img = new Uint8Array(imgFile);
  const disk = mount(img);
  const partitions = disk.getPartitions();
  expect(partitions.length).toBe(1);
  const partition = partitions[0];
  expect(partition).toStrictEqual({
    active: true,
    relativeSectors: 63,
    totalSectors: 1628865,
    type: 11,
  });
  const chs = {
    Cylinder: 807,
    Head: 31,
    Sector: 63,
  };
  const NumHeads = 32;
  const SecPerTrk = 63;
  const lastSector = partition.relativeSectors + partition.totalSectors - 1;
  expect(chs2lba(chs, NumHeads, SecPerTrk)).toBe(lastSector);
  expect(lba2chs(lastSector, NumHeads, SecPerTrk)).toStrictEqual(chs);
  const fs = mount(img, { partition: partitions[0] }).getFileSystem();
  expect(fs).toBeDefined();
  expect(fs?.getName()).toBe("FAT32");
  return fs;
};

(skip ? test.skip : test)("winme", { timeout: 30000 }, () => {
  const fs = getWinMeFs();

  const themes = fs?.getRoot().getFile("/Program Files/Plus!/Themes");
  expect(themes?.listFiles()?.length).toBe(554);

  const directX = fs?.getRoot().getFile("/WINDOWS/SYSTEM/DirectX");
  expect(directX?.length()).toBe(3107950);
  expect(directX?.getSizeOnDisk()).toBe(3641344);
});
