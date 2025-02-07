import { mount } from "libmount";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readBinaryFileSync } from "../scripts/commons.mjs";

const fs = mount(new Uint8Array(gunzipSync(readBinaryFileSync("tests/images/disk2.img.gz")))).getFileSystem();
if (!fs) {
  throw new Error();
}

test("d2-volumeInfo", () => {
  expect(fs.getName()).toBe("FAT32");
  expect(fs.getLabel()).toBe("P-FAT32");
  expect(fs.getOEMName()).toBe("mkfs.fat");
  expect(fs.getId()).toBe(0xa94ebf38);
  expect(fs.getSizeOfCluster()).toBe(4096);
  expect(fs.getCountOfClusters()).toBe(97852);
  expect(fs.getFreeClusters()).toBe(81464);
});

test("d2-getFile", () => {
  expect(fs.getRoot().getFile("test")?.isDirectory()).toBeTruthy();
  expect(fs.getRoot().getFile("64mb.dat")?.length()).toBe(64 * 1024 * 1024);
  expect(fs.getRoot().getFile("empty.dat")?.length()).toBe(0);
  expect(new TextDecoder().decode(fs.getRoot().getFile("readme.txt")?.open()?.readData() ?? new Uint8Array([0])).substring(0, 25)).toBe(
    "This is a FAT32 patition.",
  );
  expect(fs.getRoot().getFile("test/test.dat")?.length()).toBe(3500);
});

test("d2-delete", () => {
  fs.getRoot().delete();
  expect(fs.getFreeClusters() + 1).toBe(fs.getCountOfClusters());
});
