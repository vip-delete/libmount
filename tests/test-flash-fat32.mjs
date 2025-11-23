import { mount } from "libmount";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readBinaryFileSync } from "../scripts/commons.mjs";

const fs = mount(new Uint8Array(gunzipSync(readBinaryFileSync("tests/images/flash-fat32.img.gz")))).getFileSystem();
if (!fs) {
  throw new Error();
}

test("flash-fat32-info", () => {
  expect(fs.getName()).toBe("FAT32");
  expect(fs.getLabel()).toBe("FLASH");
  expect(fs.getOEMName()).toBe("LIBMOUNT");
  expect(fs.getId()).toBe(1516401102);
  expect(fs.getSizeOfCluster()).toBe(4096);
  expect(fs.getCountOfClusters()).toBe(1952627);
  expect(fs.getFreeClusters()).toBe(1952620);
});

test("flash-fat32-listFiles", () => {
  const list = fs.getRoot().listFiles();
  expect(list?.length).toBe(4);
  expect(list?.[0].getName()).toBe("🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀🐀A");
  expect(list?.[1].getName()).toBe("System Volume Information");
  expect(list?.[2].getName()).toBe("1");
  expect(list?.[3].getName()).toBe("New Text Document.txt");
});
