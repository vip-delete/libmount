import { mount } from "libmount";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readBinaryFileSync } from "../scripts/commons.mjs";

const fs = mount(new Uint8Array(gunzipSync(readBinaryFileSync("tests/images/f3.img.gz")))).getFileSystem();
if (!fs) {
  throw new Error();
}

test("f3-volumeInfo", () => {
  expect(fs.getName()).toBe("FAT16");
  expect(fs.getLabel()).toBe("HELLO");
  expect(fs.getOEMName()).toBe("mkfs.fat");
  expect(fs.getId()).toBe(2752861672);
  expect(fs.getSizeOfCluster()).toBe(2048);
  expect(fs.getCountOfClusters()).toBe(4981);
  expect(fs.getFreeClusters()).toBe(4847);
});

test("f3-getFile", () => {
  const hello = fs.getRoot().getFile("////\\doc1/\\doc2///\\doc3\\//////hello.txt");
  expect(hello?.length()).toBe(19);
  expect(new TextDecoder().decode(hello?.open()?.readData() ?? new Uint8Array([0]))).toBe("HELLO WORLD OF FAT\n");

  const dir = fs.getRoot().getFile("L");
  expect(dir?.isDirectory()).toBeTruthy();

  const list = dir?.listFiles();
  expect(list?.length).toBe(2080);
  list?.forEach((file) => {
    expect(file.length()).toBe(0);
  });
});

test("f3-delete", () => {
  fs.getRoot().getFile("/doc1")?.delete();
  fs.getRoot().getFile("/L")?.delete();
  expect(fs.getFreeClusters()).toBe(fs.getCountOfClusters());
});
