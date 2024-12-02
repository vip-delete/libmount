import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readFileSync } from "fs";

/**
 * @param {function(Uint8Array):lmNS.Disk} mount
 */
export function testD2(mount) {
  const fs = mount(new Uint8Array(gunzipSync(readFileSync("./public/images/disk2.img.gz", { flag: "r" })))).getFileSystem();
  if (fs === null) {
    throw new Error();
  }

  test("d2-volumeInfo", () => {
    expect(fs.getName()).toBe("FAT32");
    const v = fs.getVolume();
    expect(v.getLabel()).toBe("P-FAT32");
    expect(v.getOEMName()).toBe("mkfs.fat");
    expect(v.getId()).toBe(0xa94ebf38);
    expect(v.getSizeOfCluster()).toBe(4096);
    expect(v.getCountOfClusters()).toBe(97852);
    expect(v.getFreeClusters()).toBe(81464);
  });

  test("d2-getFile", () => {
    expect(fs.getRoot().getFile("test")?.isDirectory()).toBeTruthy();
    expect(fs.getRoot().getFile("64mb.dat")?.length()).toBe(64 * 1024 * 1024);
    expect(fs.getRoot().getFile("empty.dat")?.length()).toBe(0);
    expect(new TextDecoder().decode(fs.getRoot().getFile("readme.txt")?.getData() ?? new Uint8Array([0])).substring(0, 25)).toBe("This is a FAT32 patition.");
    expect(fs.getRoot().getFile("test/test.dat")?.length()).toBe(3500);
  });

  test("d2-delete", () => {
    fs.getRoot().delete();
    const v = fs.getVolume();
    expect(v.getFreeClusters() + 1).toBe(v.getCountOfClusters());
  });
}
