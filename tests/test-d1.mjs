import { readFileSync } from "fs";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";

/**
 * @param {function(Uint8Array):lmNS.Disk} mount
 */
export function testD1(mount) {
  const img = new Uint8Array(gunzipSync(readFileSync("./public/images/disk1.img.gz", { flag: "r" })));
  const disk = mount(img);
  const partitions = disk.getPartitions();

  expect(disk.getFileSystem()).toBeNull();
  expect(partitions.length).toBe(2);

  const fs = mount(img.subarray(partitions[0].begin, partitions[0].end)).getFileSystem();
  if (fs === null) {
    throw new Error();
  }

  test("d1-volumeInfo", () => {
    expect(fs.getName()).toBe("FAT16");
    const v = fs.getVolume();
    expect(v.getLabel()).toBe("P-FAT16");
    expect(v.getOEMName()).toBe("mkfs.fat");
    expect(v.getId()).toBe(0xa7100a92);
    expect(v.getSizeOfCluster()).toBe(2048);
    expect(v.getCountOfClusters()).toBe(65399);
    expect(v.getFreeClusters()).toBe(32627);
  });

  test("d1-getFile", () => {
    expect(fs.getRoot().getFile("test")?.isDirectory()).toBeTruthy();
    expect(fs.getRoot().getFile("64mb.dat")?.length()).toBe(64 * 1024 * 1024);
    expect(fs.getRoot().getFile("empty.dat")?.length()).toBe(0);
    expect(new TextDecoder().decode(fs.getRoot().getFile("readme.txt")?.getData() ?? new Uint8Array([0])).substring(0, 25)).toBe("This is a FAT16 patition.");
    expect(fs.getRoot().getFile("test/test.dat")?.length()).toBe(3500);
  });

  test("d1-delete", () => {
    fs.getRoot()
      .listFiles()
      ?.forEach((it) => it.delete());
    const v = fs.getVolume();
    expect(v.getFreeClusters()).toBe(v.getCountOfClusters());
  });
}
