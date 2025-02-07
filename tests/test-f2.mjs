import { mount } from "libmount";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readBinaryFileSync } from "../scripts/commons.mjs";

const fs = mount(new Uint8Array(gunzipSync(readBinaryFileSync("tests/images/f2.img.gz")))).getFileSystem();
if (!fs) {
  throw new Error();
}

test("f2-volumeInfo", () => {
  expect(fs.getName()).toBe("FAT12");
  expect(fs.getLabel()).toBe("NO NAME");
  expect(fs.getOEMName()).toBe("mkfs.fat");
  expect(fs.getId()).toBe(215907190);
  expect(fs.getSizeOfCluster()).toBe(32768);
  expect(fs.getCountOfClusters()).toBe(248);
  expect(fs.getFreeClusters()).toBe(247);
});

test("f2-delete", () => {
  const file = fs.getRoot().getFile("/Hello.txt");
  expect(file?.length()).toBe(44);
  expect(new TextDecoder().decode(file?.open()?.readData() ?? new Uint8Array([0]))).toBe("THIS IS A BIG STEP IN MY LIFE\n*************\n");

  const before = fs.getFreeClusters();
  file?.delete();
  const after = fs.getFreeClusters();

  expect(after - before).toBe(Math.ceil(44 / fs.getSizeOfCluster()));
  expect(after).toBe(fs.getCountOfClusters());
});
