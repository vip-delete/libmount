import { mount } from "libmount";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readBinaryFileSync } from "../scripts/commons.mjs";

const fs = mount(new Uint8Array(gunzipSync(readBinaryFileSync("tests/images/f1.img.gz")))).getFileSystem();
if (!fs) {
  throw new Error();
}

test("f1-volumeInfo", () => {
  expect(fs.getName()).toBe("FAT16");
  expect(fs.getLabel()).toBe("NO NAME");
  expect(fs.getOEMName()).toBe("mkfs.fat");
  expect(fs.getId()).toBe(939647049);
  expect(fs.getSizeOfCluster()).toBe(2048);
  expect(fs.getCountOfClusters()).toBe(4301);
  expect(fs.getFreeClusters()).toBe(4294);
});

test("f1-getFile", () => {
  expect(new TextDecoder().decode(fs.getRoot().getFile("/doc1/p.txt")?.open()?.readData() ?? new Uint8Array([0]))).toBe("Hello PARHAM\n");
  expect(new TextDecoder().decode(fs.getRoot().getFile("/DEL_ME.TXT")?.open()?.readData() ?? new Uint8Array([0]))).toBe("DEL ME PLEASE\n");
  expect(new TextDecoder().decode(fs.getRoot().getFile("/hello.txt")?.open()?.readData() ?? new Uint8Array([0]))).toBe("Hi the world\n");
  expect(new TextDecoder().decode(fs.getRoot().getFile("/test.txt")?.open()?.readData() ?? new Uint8Array([0]))).toBe("Hello world\n");

  const file = fs.getRoot().getFile("BIG_DATA.txt");
  expect(file?.length()).toBe(2560);
});

test("f1-delete", () => {
  const big = fs.getRoot().getFile("BIG_DATA.txt");
  expect(big?.isRegularFile()).toBeTruthy();
  expect(big?.length()).toBe(2560);

  const before = fs.getFreeClusters();
  big?.delete();
  const after = fs.getFreeClusters();

  expect(after - before).toBe(Math.ceil(2560 / fs.getSizeOfCluster()));

  fs.getRoot().delete();
  expect(fs.getFreeClusters()).toBe(fs.getCountOfClusters());
});
