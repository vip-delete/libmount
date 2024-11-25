import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readFileSync } from "fs";

export function testF3(mount) {
  const fs = mount(new Uint8Array(gunzipSync(readFileSync("./public/images/f3.img.gz", { flag: "r" })))).getFileSystem();

  test("f3-volumeInfo", () => {
    expect(fs.getName()).toBe("FAT16");
    const v = fs.getVolume();
    expect(v.getLabel()).toBe("HELLO");
    expect(v.getOEMName()).toBe("mkfs.fat");
    expect(v.getId()).toBe(2752861672);
    expect(v.getSizeOfCluster()).toBe(2048);
    expect(v.getCountOfClusters()).toBe(4981);
    expect(v.getFreeClusters()).toBe(4847);
  });

  test("f3-getFile", () => {
    const hello = fs.getRoot().getFile("////\\doc1/\\doc2///\\doc3\\//////hello.txt");
    expect(hello.length()).toBe(19);
    expect(new TextDecoder().decode(hello.getData())).toBe("HELLO WORLD OF FAT\n");

    const dir = fs.getRoot().getFile("L");
    expect(dir.isDirectory()).toBeTruthy();

    const list = dir.listFiles();
    expect(list.length).toBe(2080);
    list.forEach((f) => {
      expect(f.length()).toBe(0);
    });
  });

  test("f3-delete", () => {
    fs.getRoot().getFile("/doc1").delete();
    fs.getRoot().getFile("/L").delete();
    const info2 = fs.getVolume();
    expect(info2.getFreeClusters()).toBe(info2.getCountOfClusters());
  });
}
