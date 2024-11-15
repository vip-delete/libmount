import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readFileSync } from "fs";

export function f3(mount) {
  const fs = mount(new Uint8Array(gunzipSync(readFileSync("./public/images/f3.img.gz", { flag: "r" })))).getFileSystem();

  test("f3-volumeInfo", () => {
    expect(fs.getName()).toBe("FAT16");
    expect(fs.getVolumeInfo()).toStrictEqual({
      //
      "label": "HELLO",
      "oemName": "mkfs.fat",
      "serialNumber": 2752861672,
      "clusterSize": 2048,
      "totalClusters": 4981,
      "freeClusters": 4847,
    });
  });

  test("f3-getFile", () => {
    const hello = fs.getFile("////\\doc1/\\doc2///\\doc3\\//////hello.txt");
    expect(hello.length()).toBe(19);
    expect(new TextDecoder().decode(hello.getData())).toBe("HELLO WORLD OF FAT\n");

    const dir = fs.getFile("L");
    expect(dir.isDirectory()).toBeTruthy();

    const list = dir.listFiles();
    expect(list.length).toBe(2080);
    list.forEach((f) => {
      expect(f.length()).toBe(0);
    });
  });

  test("f3-delete", () => {
    fs.getFile("/doc1").delete();
    fs.getFile("/L").delete();
    const info2 = fs.getVolumeInfo();
    expect(info2.freeClusters).toBe(info2.totalClusters);
  });
}
