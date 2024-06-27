import { readFileSync } from "fs";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";

export function f2(mount) {
  const fs = mount(new Uint8Array(gunzipSync(readFileSync("./public/images/f2.img.gz", { flag: "r" })))).getFileSystem();

  test("f2-volumeInfo", () => {
    expect(fs.getName()).toBe("FAT12");
    expect(fs.getVolumeInfo()).toStrictEqual({
      //
      "label": "NO NAME",
      "OEMName": "mkfs.fat",
      "serialNumber": 215907190,
      "clusterSize": 32768,
      "totalClusters": 248,
      "freeClusters": 247,
    });
  });

  test("f2-delete", () => {
    const f = fs.getFile("/Hello.txt");
    expect(f.length()).toBe(44);
    expect(new TextDecoder().decode(f.getData())).toBe("THIS IS A BIG STEP IN MY LIFE\n*************\n");
    
    const info = fs.getVolumeInfo();
    f.delete();
    const info2 = fs.getVolumeInfo();

    expect(info2.freeClusters - info.freeClusters).toBe(Math.ceil(44 / info.clusterSize));
    expect(info2.freeClusters).toBe(info2.totalClusters);
  });
}
