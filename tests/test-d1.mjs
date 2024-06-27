import { readFileSync } from "fs";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";

export function d1(mount) {
  const img = new Uint8Array(gunzipSync(readFileSync("./public/images/disk1.img.gz", { flag: "r" })));
  const disk = mount(img);
  const partitions = disk.getPartitions();

  expect(disk.getFileSystem()).toBeNull();
  expect(partitions.length).toBe(2);

  const fs = mount(img.subarray(partitions[0].begin, partitions[0].end)).getFileSystem();

  test("d1-volumeInfo", () => {
    expect(fs.getName()).toBe("FAT16");
    expect(fs.getVolumeInfo()).toStrictEqual({
      //
      "label": "P-FAT16",
      "OEMName": "mkfs.fat",
      "serialNumber": 0xa7100a92,
      "clusterSize": 2048,
      "totalClusters": 65399,
      "freeClusters": 32627,
    });
  });

  test("d1-getFile", () => {
    expect(fs.getFile("test").isDirectory()).toBeTruthy();
    expect(fs.getFile("64mb.dat").length()).toBe(64 * 1024 * 1024);
    expect(fs.getFile("empty.dat").length()).toBe(0);
    expect(new TextDecoder().decode(fs.getFile("readme.txt").getData()).substring(0, 25)).toBe("This is a FAT16 patition.");
    expect(fs.getFile("test/test.dat").length()).toBe(3500);
  });

  test("d1-delete", () => {
    fs.getRoot()
      .listFiles()
      .forEach((it) => it.delete());
    const info = fs.getVolumeInfo();
    expect(info.freeClusters).toBe(info.totalClusters);
  });
}
