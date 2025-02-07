import { mount } from "libmount";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readBinaryFileSync } from "../scripts/commons.mjs";

const img = new Uint8Array(gunzipSync(readBinaryFileSync("tests/images/disk1.img.gz")));
const disk = mount(img);
const partitions = disk.getPartitions();

expect(partitions.length).toBe(2);

const fs = mount(img, { partition: partitions[0] }).getFileSystem();
if (!fs) {
  throw new Error();
}

test("d1-volumeInfo", () => {
  expect(fs.getName()).toBe("FAT16");
  expect(fs.getLabel()).toBe("P-FAT16");
  expect(fs.getOEMName()).toBe("mkfs.fat");
  expect(fs.getId()).toBe(0xa7100a92);
  expect(fs.getSizeOfCluster()).toBe(2048);
  expect(fs.getCountOfClusters()).toBe(65399);
  expect(fs.getFreeClusters()).toBe(32627);
});

test("d1-getFile", () => {
  expect(fs.getRoot().getFile("test")?.isDirectory()).toBeTruthy();
  expect(fs.getRoot().getFile("64mb.dat")?.length()).toBe(64 * 1024 * 1024);
  expect(fs.getRoot().getFile("empty.dat")?.length()).toBe(0);
  expect(new TextDecoder().decode(fs.getRoot().getFile("readme.txt")?.open()?.readData() ?? new Uint8Array([0])).substring(0, 25)).toBe(
    "This is a FAT16 patition.",
  );
  expect(fs.getRoot().getFile("test/test.dat")?.length()).toBe(3500);
});

test("d1-delete", () => {
  fs.getRoot()
    .listFiles()
    ?.forEach((it) => it.delete());
  expect(fs.getFreeClusters()).toBe(fs.getCountOfClusters());
});
