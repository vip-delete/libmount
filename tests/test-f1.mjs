import { readFileSync } from "fs";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";

export function f1(mount) {
  const fs = mount(new Uint8Array(gunzipSync(readFileSync("./public/images/f1.img.gz", { flag: "r" })))).getFileSystem();

  test("f1-volumeInfo", () => {
    expect(fs.getName()).toBe("FAT16");
    expect(fs.getVolumeInfo()).toStrictEqual({
      //
      "label": "NO NAME",
      "OEMName": "mkfs.fat",
      "serialNumber": 939647049,
      "clusterSize": 2048,
      "totalClusters": 4301,
      "freeClusters": 4294,
    });
  });

  test("f1-getFile", () => {
    expect(new TextDecoder().decode(fs.getFile("/doc1/p.txt").getData())).toBe("Hello PARHAM\n");
    expect(new TextDecoder().decode(fs.getFile("/DEL_ME.TXT").getData())).toBe("DEL ME PLEASE\n");
    expect(new TextDecoder().decode(fs.getFile("/hello.txt").getData())).toBe("Hi the world\n");
    expect(new TextDecoder().decode(fs.getFile("/test.txt").getData())).toBe("Hello world\n");

    const f = fs.getFile("BIG_DATA.txt");
    expect(f.length()).toBe(2560);
  });

  test("f1-delete", () => {
    const f = fs.getFile("BIG_DATA.txt");
    expect(f.length()).toBe(2560);

    const info = fs.getVolumeInfo();
    f.delete();
    const info2 = fs.getVolumeInfo();

    expect(info2.freeClusters - info.freeClusters).toBe(Math.ceil(2560 / info.clusterSize));

    fs.getRoot()
      .listFiles()
      .forEach((f) => f.delete());
    const info3 = fs.getVolumeInfo();
    expect(info3.freeClusters).toBe(info3.totalClusters);
  });
}
