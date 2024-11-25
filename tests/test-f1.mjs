import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readFileSync } from "fs";

export function testF1(mount) {
  const fs = mount(new Uint8Array(gunzipSync(readFileSync("./public/images/f1.img.gz", { flag: "r" })))).getFileSystem();

  test("f1-volumeInfo", () => {
    expect(fs.getName()).toBe("FAT16");
    const v = fs.getVolume();
    expect(v.getLabel()).toBe("NO NAME");
    expect(v.getOEMName()).toBe("mkfs.fat");
    expect(v.getId()).toBe(939647049);
    expect(v.getSizeOfCluster()).toBe(2048);
    expect(v.getCountOfClusters()).toBe(4301);
    expect(v.getFreeClusters()).toBe(4294);
  });

  test("f1-getFile", () => {
    expect(new TextDecoder().decode(fs.getRoot().getFile("/doc1/p.txt").getData())).toBe("Hello PARHAM\n");
    expect(new TextDecoder().decode(fs.getRoot().getFile("/DEL_ME.TXT").getData())).toBe("DEL ME PLEASE\n");
    expect(new TextDecoder().decode(fs.getRoot().getFile("/hello.txt").getData())).toBe("Hi the world\n");
    expect(new TextDecoder().decode(fs.getRoot().getFile("/test.txt").getData())).toBe("Hello world\n");

    const f = fs.getRoot().getFile("BIG_DATA.txt");
    expect(f.length()).toBe(2560);
  });

  test("f1-delete", () => {
    const big = fs.getRoot().getFile("BIG_DATA.txt");
    expect(big.isRegularFile()).toBeTruthy();
    expect(big.length()).toBe(2560);

    const v = fs.getVolume();
    const before = v.getFreeClusters();
    big.delete();
    const after = v.getFreeClusters();

    expect(after - before).toBe(Math.ceil(2560 / v.getSizeOfCluster()));

    fs.getRoot().delete();
    expect(v.getFreeClusters()).toBe(v.getCountOfClusters());
  });
}
