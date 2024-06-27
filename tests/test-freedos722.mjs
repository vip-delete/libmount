/* eslint-disable max-lines-per-function */
import { expect, test } from "vitest";
import { readFileSync } from "fs";

export function freedos722(mount) {
  const fs = mount(new Uint8Array(readFileSync("./public/images/freedos722.img", { flag: "r" }))).getFileSystem();

  test("getVolumeInfo", () => {
    expect(fs.getName()).toBe("FAT12");
    expect(fs.getVolumeInfo()).toStrictEqual({
      //
      "label": "FREEDOS",
      "oemName": "FreeDOS",
      "serialNumber": 3838401768,
      "clusterSize": 1024,
      "totalClusters": 713,
      "freeClusters": 45,
    });
  });

  test("getRoot", () => {
    [fs.getRoot(), fs.getFile("/"), fs.getFile("\\"), fs.getFile("//"), fs.getFile("\\\\////")].forEach((root) => {
      expect(root.getName()).toBe("");
      expect(root.getShortName()).toBe("");
      expect(root.isRegularFile()).toBeFalsy();
      expect(root.isDirectory()).toBeTruthy();
      expect(root.length()).toBe(0);
      expect(root.getAbsolutePath()).toBe("/");
      expect(root.lastModified().toISOString()).toBe("1970-01-01T00:00:00.000Z");
      expect(root.creationTime().toISOString()).toBe("1970-01-01T00:00:00.000Z");
      expect(root.lastAccessTime().toISOString()).toBe("1970-01-01T00:00:00.000Z");
      expect(root.getData()).toBeNull();
      expect(root.length()).toBe(0);
      expect(root.delete()).toBeUndefined();
    });
  });

  test("getFile", () => {
    const kernel = fs.getFile("kernel.sys");
    expect(kernel.getName()).toBe("KERNEL.SYS");
    expect(kernel.getShortName()).toBe("KERNEL.SYS");
    expect(kernel.isRegularFile()).toBeTruthy();
    expect(kernel.isDirectory()).toBeFalsy();
    expect(kernel.getAbsolutePath()).toBe("/KERNEL.SYS");

    const games = fs.getFile("\\\\GAMES");
    expect(games.getName()).toBe("games");
    expect(games.getShortName()).toBe("GAMES");
    expect(games.isRegularFile()).toBeFalsy();
    expect(games.isDirectory()).toBeTruthy();
    expect(games.getAbsolutePath()).toBe("/games");

    const games1 = fs.getFile("/GAMES");
    expect(games1.getName()).toBe("games");
    expect(games1.getAbsolutePath()).toBe("/games");

    const games2 = fs.getFile("////GaMeS");
    expect(games2.getName()).toBe("games");
    expect(games2.getAbsolutePath()).toBe("/games");

    const minesweeper = games2.getFile("MiNeSw~1.COM//");
    expect(minesweeper.getName()).toBe("minesweeper.com");
    expect(minesweeper.getShortName()).toBe("MINESW~1.COM");
    expect(minesweeper.isRegularFile()).toBeTruthy();
    expect(minesweeper.isDirectory()).toBeFalsy();
    expect(minesweeper.getAbsolutePath()).toBe("/games/minesweeper.com");

    expect(minesweeper.findFirst(() => true)).toBeNull();
    expect(minesweeper.findAll(() => true)).toBeNull();

    expect(fs.getRoot().listFiles().length).toBe(22);
    expect(
      fs
        .getRoot()
        .findFirst((it) => it.length() > 1000 && it.length() < 10000)
        .getName(),
    ).toBe("README");
    expect(fs.getRoot().findAll((it) => it.length() > 1000 && it.length() < 10000).length).toBe(6);
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
    expect(fs.getRoot().length()).toBe(0);
    expect(fs.getFile("kernel.sys").length()).toBe(45450);
    expect(fs.getFile("games").length()).toBe(0);
    expect(fs.getFile("games/rogue.exe").length()).toBe(99584);
    expect(fs.getFile("foo").length()).toBe(10);
  });

  test("creationTime", () => {
    expect(fs.getRoot().creationTime().toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(fs.getFile("kernel.sys").creationTime().toISOString()).toBe("2012-04-07T08:13:05.500Z");
    expect(fs.getFile("games").creationTime().toISOString()).toBe("2013-05-04T03:29:07.000Z");
    expect(fs.getFile("games/rogue.exe").creationTime().toISOString()).toBe("2013-05-04T03:29:07.000Z");
    expect(fs.getFile("foo").creationTime().toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  test("lastModified", () => {
    expect(fs.getRoot().lastModified().toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(fs.getFile("kernel.sys").lastModified().toISOString()).toBe("2012-04-07T08:13:00.000Z");
    expect(fs.getFile("games").lastModified().toISOString()).toBe("2013-05-04T03:29:06.000Z");
    expect(fs.getFile("games/rogue.exe").lastModified().toISOString()).toBe("2012-10-25T21:19:38.000Z");
    expect(fs.getFile("foo").lastModified().toISOString()).toBe("2012-10-25T20:38:52.000Z");
  });

  test("lastAccessTime", () => {
    expect(fs.getRoot().lastAccessTime().toISOString()).toBe("1970-01-01T00:00:00.000Z");
    expect(fs.getFile("kernel.sys").lastAccessTime().toISOString()).toBe("2012-04-07T00:00:00.000Z");
    expect(fs.getFile("games").lastAccessTime().toISOString()).toBe("2013-05-04T00:00:00.000Z");
    expect(fs.getFile("games/rogue.exe").lastAccessTime().toISOString()).toBe("2012-10-25T00:00:00.000Z");
    expect(fs.getFile("foo").lastAccessTime().toISOString()).toBe("1970-01-01T00:00:00.000Z");
  });

  test("delete", () => {
    const length = fs.getRoot().listFiles().length;
    fs.getRoot().delete();
    expect(fs.getRoot().listFiles().length).toBe(length);

    fs.getFile("hello.asm").delete();
    expect(fs.getRoot().listFiles().length).toBe(length - 1);

    fs.getFile("foo").delete();
    expect(fs.getRoot().listFiles().length).toBe(length - 2);

    fs.getFile("x86test.asm").delete();
    expect(fs.getRoot().listFiles().length).toBe(length - 3);

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

  test("mkfile", () => {
    expect(fs.mkfile("A.TXT").isRegularFile()).toBeTruthy();
    expect(fs.mkdir("B.TXT").isDirectory()).toBeTruthy();
    expect(fs.mkfile("c.txt").isRegularFile()).toBeTruthy();
    expect(fs.mkfile("c.txt").mkdir("1")).toBeNull();
    expect(fs.mkdir("d.txt").isDirectory()).toBeTruthy();
    expect(fs.mkfile("/+/+/+.txt").getAbsolutePath()).toBe("/+/+/+.txt");
    expect(fs.mkfile("/+/+/.txt").getAbsolutePath()).toBe("/+/+/.txt");
    expect(fs.mkfile("/+/🐀/🐀.txt").getAbsolutePath()).toBe("/+/🐀/🐀.txt");
    expect(fs.mkfile("/+/🐀/гггг.txt").getAbsolutePath()).toBe("/+/🐀/гггг.txt");
    expect(fs.mkfile("TEST1/A.TXT").isRegularFile()).toBeTruthy();
    expect(fs.mkdir("TEST2/B.TXT").isDirectory()).toBeTruthy();
    expect(fs.mkfile("test3/c.txt").isRegularFile()).toBeTruthy();
    expect(fs.mkdir("test4/d.txt").isDirectory()).toBeTruthy();
    expect(fs.mkfile("TEST1/A1.TXT").isRegularFile()).toBeTruthy();
    expect(fs.mkdir("TEST2/B2.TXT").isDirectory()).toBeTruthy();
    expect(fs.mkfile("test3/c3.txt").isRegularFile()).toBeTruthy();
    expect(fs.mkdir("test4/d4.txt").isDirectory()).toBeTruthy();
    expect(fs.mkfile("test4/d4.txt")).toBeNull();
    expect(fs.mkfile("a/b/c/d/e.f").isRegularFile()).toBeTruthy();
    expect(fs.mkdir("a/b/c/d/e.f")).toBeNull();
    expect(fs.mkdir("a/*")).toBeNull();
    expect(fs.mkfile("a/?.txt")).toBeNull();
    const name = " .+,;=[]...";
    fs.mkdir(name);
    const d = fs.getFile(name);
    expect(d.isDirectory()).toBeTruthy();
  });
}
