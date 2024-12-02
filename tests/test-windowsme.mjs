import { existsSync, readFileSync } from "fs";
import { expect, test } from "vitest";

/**
 * @param {function(Uint8Array,lmNS.MountOptions=):lmNS.Disk} mount
 */
export function testWindowsMe(mount) {
  const filename = "./public/images/fat32/windowsme.img";
  if (!existsSync(filename)) {
    return;
  }

  const imgFile = readFileSync(filename, { flag: "r" });
  const img = new Uint8Array(imgFile);
  const disk = mount(img);
  expect(disk.getFileSystem()).toBeNull();
  const partitions = disk.getPartitions();
  expect(partitions.length).toBe(1);
  expect(partitions[0]).toStrictEqual({
    active: true,
    begin: 32256,
    end: 834011136,
    type: 11,
  });
  const fs = mount(img, { partition: partitions[0] }).getFileSystem();
  expect(fs?.getName()).toBe("FAT32");

  test("winme-listFiles", () => {
    const themes = fs?.getRoot().getFile("/Program Files/Plus!/Themes");
    expect(themes?.listFiles()?.length).toBe(554);
  });

  test("winme-getSizeOnDisk", () => {
    const directX = fs?.getRoot().getFile("/WINDOWS/SYSTEM/DirectX");
    expect(directX?.length()).toBe(3107950);
    expect(directX?.getSizeOnDisk()).toBe(3641344);
  });
}
