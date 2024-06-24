import { readFileSync } from "fs";
import { expect, test } from "vitest";

export function freedos722(mount) {
  const buf = readFileSync("./public/images/freedos722.img", { flag: "r" });
  const fs = mount(buf.buffer);

  test("getVolumeInfo", () => {
    expect(fs.getName()).toBe("FAT12");
    expect(fs.getVolumeInfo()).toStrictEqual({
      //
      "label": "FREEDOS",
      "serialNumber": 3838401768,
      "clusterSize": 1024,
      "totalClusters": 713,
      "freeClusters": 45,
    });
  });

  test("getFile", () => {
    const root = fs.getFile("/");
    expect(root.getName()).toBe("");
    expect(root.getShortName()).toBe("");
    expect(root.getLongName()).toBeNull();
    expect(root.length()).toBe(0);
    expect(root.getAbsolutePath()).toBe("/");

    const kernel = fs.getFile("kernel.sys");
    expect(kernel.getName()).toBe("KERNEL.SYS");
    expect(kernel.getShortName()).toBe("KERNEL.SYS");
    expect(kernel.getLongName()).toBeNull();
    expect(kernel.isRegularFile()).toBeTruthy();
    expect(kernel.isDirectory()).toBeFalsy();
    expect(kernel.getAbsolutePath()).toBe("/KERNEL.SYS");

    const games = fs.getFile("GAMES");
    expect(games.getName()).toBe("games");
    expect(games.getShortName()).toBe("GAMES");
    expect(games.getLongName()).toBe("games");
    expect(games.isRegularFile()).toBeFalsy();
    expect(games.isDirectory()).toBeTruthy();
    expect(games.getAbsolutePath()).toBe("/games");

    const games1 = fs.getFile("/GAMES");
    expect(games1.getName()).toBe("games");
    expect(games1.getAbsolutePath()).toBe("/games");

    const games2 = fs.getFile("/GaMeS");
    expect(games2.getName()).toBe("games");
    expect(games2.getAbsolutePath()).toBe("/games");

    const minesweeper = fs.getFile("/games/MiNeSw~1.COM");
    expect(minesweeper.getName()).toBe("minesweeper.com");
    expect(minesweeper.getShortName()).toBe("MINESW~1.COM");
    expect(minesweeper.getLongName()).toBe("minesweeper.com");
    expect(minesweeper.isRegularFile()).toBeTruthy();
    expect(minesweeper.isDirectory()).toBeFalsy();
    expect(minesweeper.getAbsolutePath()).toBe("/games/minesweeper.com");

    expect(fs.getFile("/").listFiles().length).toBe(22);
  });

  test("getData", () => {
    const games = fs.getFile("games");
    expect(games.isDirectory()).toBeTruthy();
    expect(games.getData()).toBeNull();

    expect(fs.getFile("hello.asm").getData().byteLength).toBe(163);
    expect(new TextDecoder().decode(fs.getFile("foo").getData())).toBe("\r\nqwer\r\n\r\n");

    const vimBuf = fs.getFile("vim.exe").getData();
    expect(vimBuf.byteLength).toBe(205718);
    expect(vimBuf.slice(0, 6)).toStrictEqual(new Uint8Array([0x4d, 0x5a, 0x96, 0x01, 0x92, 0x01]));
    expect(vimBuf.slice(-6)).toStrictEqual(new Uint8Array([0x74, 0x80, 0x00, 0x9f, 0x01, 0x1e]));
  });

  test("length", () => {
    expect(fs.getFile("/").length()).toBe(0);
    expect(fs.getFile("kernel.sys").length()).toBe(45450);
    expect(fs.getFile("games").length()).toBe(0);
    expect(fs.getFile("games/rogue.exe").length()).toBe(99584);
    expect(fs.getFile("foo").length()).toBe(10);
  });

  test("creationTime", () => {
    expect(fs.getFile("/").creationTime().toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(fs.getFile("kernel.sys").creationTime().toISOString()).toBe("2012-04-07T08:13:05.500Z");
    expect(fs.getFile("games").creationTime().toISOString()).toBe("2013-05-04T03:29:07.000Z");
    expect(fs.getFile("games/rogue.exe").creationTime().toISOString()).toBe("2013-05-04T03:29:07.000Z");
    expect(fs.getFile("foo").creationTime().toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  test("lastModified", () => {
    expect(fs.getFile("/").lastModified().toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(fs.getFile("kernel.sys").lastModified().toISOString()).toBe("2012-04-07T08:13:00.000Z");
    expect(fs.getFile("games").lastModified().toISOString()).toBe("2013-05-04T03:29:06.000Z");
    expect(fs.getFile("games/rogue.exe").lastModified().toISOString()).toBe("2012-10-25T21:19:38.000Z");
    expect(fs.getFile("foo").lastModified().toISOString()).toBe("2012-10-25T20:38:52.000Z");
  });

  test("lastAccessTime", () => {
    expect(fs.getFile("/").lastAccessTime().toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(fs.getFile("kernel.sys").lastAccessTime().toISOString()).toBe("2012-04-07T00:00:00.000Z");
    expect(fs.getFile("games").lastAccessTime().toISOString()).toBe("2013-05-04T00:00:00.000Z");
    expect(fs.getFile("games/rogue.exe").lastAccessTime().toISOString()).toBe("2012-10-25T00:00:00.000Z");
    expect(fs.getFile("foo").lastAccessTime().toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  test("delete", () => {
    const length = fs.getFile("/").listFiles().length;
    fs.getFile("/").delete();
    expect(fs.getFile("/").listFiles().length).toBe(length);

    fs.getFile("hello.asm").delete();
    expect(fs.getFile("/").listFiles().length).toBe(length - 1);

    fs.getFile("foo").delete();
    expect(fs.getFile("/").listFiles().length).toBe(length - 2);

    fs.getFile("x86test.asm").delete();
    expect(fs.getFile("/").listFiles().length).toBe(length - 3);

    const length2 = fs.getFile("GaMeS").listFiles().length;
    expect(length2).toBe(6);
    fs.getFile("/games/minesweeper.com").delete();
    fs.getFile("/games/rogue.exe").delete();
    expect(fs.getFile("GaMeS").listFiles().length).toBe(length2 - 2);

    fs.getFile("/games").delete();
    expect(fs.getFile("/games")).toBeNull();

    fs.getRoot()
      .listFiles()
      .forEach((f) => f.delete());
    const info = fs.getVolumeInfo();
    expect(info.freeClusters).toBe(info.totalClusters);
  });
}
