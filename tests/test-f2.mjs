import { readFileSync } from "fs";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";

/**
 * @param {function(Uint8Array):lmNS.Disk} mount
 */
export function testF2(mount) {
  const fs = mount(new Uint8Array(gunzipSync(readFileSync("./public/images/f2.img.gz", { flag: "r" })))).getFileSystem();
  if (fs === null) {
    throw new Error();
  }

  test("f2-volumeInfo", () => {
    expect(fs.getName()).toBe("FAT12");
    const v = fs.getVolume();
    expect(v.getLabel()).toBe("NO NAME");
    expect(v.getOEMName()).toBe("mkfs.fat");
    expect(v.getId()).toBe(215907190);
    expect(v.getSizeOfCluster()).toBe(32768);
    expect(v.getCountOfClusters()).toBe(248);
    expect(v.getFreeClusters()).toBe(247);
  });

  test("f2-delete", () => {
    const f = fs.getRoot().getFile("/Hello.txt");
    expect(f?.length()).toBe(44);
    expect(new TextDecoder().decode(f?.getData() ?? new Uint8Array([0]))).toBe("THIS IS A BIG STEP IN MY LIFE\n*************\n");

    const v = fs.getVolume();
    const before = v.getFreeClusters();
    f?.delete();
    const after = v.getFreeClusters();

    expect(after - before).toBe(Math.ceil(44 / v.getSizeOfCluster()));
    expect(after).toBe(v.getCountOfClusters());
  });
}
