import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readFileSync } from "fs";

export function d2(mount) {
  const fs = mount(new Uint8Array(gunzipSync(readFileSync("./public/images/disk2.img.gz", { flag: "r" })))).getFileSystem();

  test("d2-volumeInfo", () => {
    expect(fs.getName()).toBe("FAT32");
    expect(fs.getVolumeInfo()).toStrictEqual({
      //
      "label": "P-FAT32",
      "oemName": "mkfs.fat",
      "serialNumber": 0xa94ebf38,
      "clusterSize": 4096,
      "totalClusters": 97852,
      "freeClusters": 81464,
    });
  });

  test("d2-getFile", () => {
    expect(fs.getFile("test").isDirectory()).toBeTruthy();
    expect(fs.getFile("64mb.dat").length()).toBe(64 * 1024 * 1024);
    expect(fs.getFile("empty.dat").length()).toBe(0);
    expect(new TextDecoder().decode(fs.getFile("readme.txt").getData()).substring(0, 25)).toBe("This is a FAT32 patition.");
    expect(fs.getFile("test/test.dat").length()).toBe(3500);
  });

  test("d2-delete", () => {
    fs.getRoot()
      .listFiles()
      .forEach((it) => it.delete());
    const info = fs.getVolumeInfo();
    expect(info.freeClusters + 1).toBe(info.totalClusters);
  });
}
