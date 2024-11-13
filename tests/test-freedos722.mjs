/* eslint-disable max-lines-per-function */
import { expect, test } from "vitest";
import { readFileSync } from "fs";

export function testFreedos722(mount) {
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

  test("makeFile", () => {
    expect(fs.makeFile("A.TXT", false).isRegularFile()).toBeTruthy();
    expect(fs.makeFile("B.TXT", true).isDirectory()).toBeTruthy();
    expect(fs.makeFile("c.txt", false).isRegularFile()).toBeTruthy();
    expect(fs.makeFile("c.txt", false).makeFile("1", true)).toBeNull();
    expect(fs.makeFile("d.txt", true).isDirectory()).toBeTruthy();
    expect(fs.makeFile("/+/+/+.txt", false).getAbsolutePath()).toBe("/+/+/+.txt");
    expect(fs.makeFile("/+/+/.txt", false).getAbsolutePath()).toBe("/+/+/.txt");
    expect(fs.makeFile("/+/🐀/🐀.txt", false).getAbsolutePath()).toBe("/+/🐀/🐀.txt");
    expect(fs.makeFile("/+/🐀/гггг.txt", false).getAbsolutePath()).toBe("/+/🐀/гггг.txt");
    expect(fs.makeFile("TEST1/A.TXT", false).isRegularFile()).toBeTruthy();
    expect(fs.makeFile("TEST2/B.TXT", true).isDirectory()).toBeTruthy();
    expect(fs.makeFile("test3/c.txt", false).isRegularFile()).toBeTruthy();
    expect(fs.makeFile("test4/d.txt", true).isDirectory()).toBeTruthy();
    expect(fs.makeFile("TEST1/A1.TXT", false).isRegularFile()).toBeTruthy();
    expect(fs.makeFile("TEST2/B2.TXT", true).isDirectory()).toBeTruthy();
    expect(fs.makeFile("test3/c3.txt", false).isRegularFile()).toBeTruthy();
    expect(fs.makeFile("test4/d4.txt", true).isDirectory()).toBeTruthy();
    expect(fs.makeFile("test4/d4.txt", false)).toBeNull();
    expect(fs.makeFile("a/b/c/d/e.f", false).isRegularFile()).toBeTruthy();
    expect(fs.makeFile("a/b/c/d/e.f", true)).toBeNull();
    expect(fs.makeFile("a/*", true)).toBeNull();
    expect(fs.makeFile("a/?.txt", false)).toBeNull();
    const name = " .+,;=[]...";
    fs.makeFile(name, true);
    const d = fs.getFile(name);
    expect(d.isDirectory()).toBeTruthy();
  });

  test("moveDir", () => {
    expect(fs.moveFile("/", "/")).toBeNull();
    expect(fs.moveFile("/", "")).toBeNull();
    expect(fs.moveFile("", "/")).toBeNull();
    expect(fs.moveFile("", "")).toBeNull();
    expect(fs.moveFile("/", "/123")).toBeNull();

    fs.makeFile("moveTest", true);
    fs.makeFile("abc123", true);
    fs.makeFile("abc123/subDir", true);
    fs.makeFile("abc123/someFile", false);
    expect(fs.moveFile("notExisted", "/")).toBeNull();
    expect(fs.moveFile("notExisted/unknown", "/")).toBeNull();
    expect(fs.moveFile("invalid*name", "/")).toBeNull();
    expect(fs.moveFile("abc123", "/").getAbsolutePath()).toBe("/abc123");
    expect(fs.moveFile("abc123/subDir", "/abc123").getAbsolutePath()).toBe("/abc123/subDir");
    expect(fs.moveFile("moveTest", "invalid*name")).toBeNull();
    expect(fs.moveFile("moveTest", "abc123/invalid*name")).toBeNull();
    expect(fs.moveFile("moveTest", "abc123/invalid*name/invalid*name")).toBeNull();
    expect(fs.moveFile("moveTest", "abc123/newDir/invalid*name")).toBeNull();
    expect(fs.moveFile("moveTest", "abc123/someFile")).toBeNull();
    expect(fs.moveFile("moveTest", "abc123").getAbsolutePath()).toBe("/abc123/moveTest");
    expect(fs.moveFile("abc123", "moveRenamed").getAbsolutePath()).toBe("/moveRenamed");
    expect(fs.getFile("moveTest")).toBeNull();
    expect(fs.getFile("abc123")).toBeNull();
    expect(fs.getFile("moveRenamed")).toBeDefined();

    fs.makeFile("/d1+/d2+", true);
    expect(fs.moveFile("/d1+", "/D1+/D2+")).toBeNull();
    expect(fs.moveFile("/d1+/d2+", "/D1+/D3+").getAbsolutePath()).toBe("/d1+/D3+");

    fs.makeFile("/1/2/3/4/5", false);
    expect(fs.moveFile("/1/2/3", "/1").getAbsolutePath()).toBe("/1/3");
    expect(fs.getFile("/1/2").isDirectory()).toBeTruthy();
    expect(fs.getFile("/1/2").listFiles().length).toBe(0);
    expect(fs.getFile("/1/3/4/5").isRegularFile()).toBeTruthy();
  });

  test("moveFile", () => {
    fs.makeFile("moveFile", false);
    fs.makeFile("appleDir", true);
    fs.makeFile("appleDir/dummy", false);
    expect(fs.moveFile("moveFile", "/").getAbsolutePath()).toBe("/moveFile");
    expect(fs.moveFile("appleDir/dummy", "/appleDir").getAbsolutePath()).toBe("/appleDir/dummy");
    expect(fs.moveFile("moveFile", "invalid*name")).toBeNull();
    expect(fs.moveFile("moveFile", "appleDir/invalid*name")).toBeNull();
    expect(fs.moveFile("moveFile", "appleDir/newDir/invalid*name")).toBeNull();
    expect(fs.moveFile("moveFile", "appleDir").getAbsolutePath()).toBe("/appleDir/moveFile");
    expect(fs.moveFile("appleDir/moveFile", "dummy")).toBeNull();
    expect(fs.moveFile("appleDir/moveFile", "dummy1").getAbsolutePath()).toBe("/appleDir/dummy1");
    expect(fs.moveFile("appleDir/dummy1", "/moveFile1").getAbsolutePath()).toBe("/moveFile1");
    expect(fs.moveFile("moveFile1", "appleDir/dummy")).toBeNull();
    expect(fs.moveFile("moveFile1", "appleDir/newFile").getAbsolutePath()).toBe("/appleDir/newFile");
  });
}
