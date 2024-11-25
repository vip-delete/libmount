/* eslint-disable max-lines-per-function */
import { expect, test } from "vitest";
import { readFileSync } from "fs";

export function testFreedos722(mount) {
  const fs = mount(new Uint8Array(readFileSync("./public/images/freedos722.img", { flag: "r" }))).getFileSystem();

  test("getVolume", () => {
    expect(fs.getName()).toBe("FAT12");
    const v = fs.getVolume();
    expect(v.getLabel()).toBe("FREEDOS");
    expect(v.getOEMName()).toBe("FreeDOS");
    expect(v.getId()).toBe(3838401768);
    expect(v.getSizeOfCluster()).toBe(1024);
    expect(v.getCountOfClusters()).toBe(713);
    expect(v.getFreeClusters()).toBe(45);
  });

  test("getRoot", () => {
    [fs.getRoot(), fs.getRoot().getFile("/"), fs.getRoot().getFile("\\"), fs.getRoot().getFile("//"), fs.getRoot().getFile("\\\\////")].forEach((root) => {
      expect(root.getName()).toBe("");
      expect(root.getShortName()).toBe("");
      expect(root.isRegularFile()).toBeFalsy();
      expect(root.isDirectory()).toBeTruthy();
      expect(root.getAbsolutePath()).toBe("/");
      expect(root.lastModified()).toBeNull();
      expect(root.creationTime()).toBeNull();
      expect(root.lastAccessTime()).toBeNull();
      expect(root.getData()).toBeNull();
      expect(root.setData(new Uint8Array())).toBeNull();
      expect(root.length() > 0).toBeTruthy();
    });
  });

  test("getSizeOnDisk", () => {
    expect(fs.getRoot().length()).toBe(658675);
    const info = fs.getVolume();
    expect(fs.getRoot().getSizeOnDisk()).toBe((info.getCountOfClusters() - info.getFreeClusters()) * info.getSizeOfCluster());
  });

  test("getFile", () => {
    const kernel = fs.getRoot().getFile("kernel.sys");
    expect(kernel.getName()).toBe("KERNEL.SYS");
    expect(kernel.getShortName()).toBe("KERNEL.SYS");
    expect(kernel.isRegularFile()).toBeTruthy();
    expect(kernel.isDirectory()).toBeFalsy();
    expect(kernel.getAbsolutePath()).toBe("/KERNEL.SYS");

    const games = fs.getRoot().getFile("\\\\GAMES");
    expect(games.getName()).toBe("games");
    expect(games.getShortName()).toBe("GAMES");
    expect(games.isRegularFile()).toBeFalsy();
    expect(games.isDirectory()).toBeTruthy();
    expect(games.getAbsolutePath()).toBe("/games");

    const games1 = fs.getRoot().getFile("/GAMES");
    expect(games1.getName()).toBe("games");
    expect(games1.getAbsolutePath()).toBe("/games");

    const games2 = fs.getRoot().getFile("////GaMeS");
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
    const games = fs.getRoot().getFile("games");
    expect(games.isDirectory()).toBeTruthy();
    expect(games.getData()).toBeNull();

    expect(fs.getRoot().getFile("hello.asm").getData().byteLength).toBe(163);
    expect(new TextDecoder().decode(fs.getRoot().getFile("foo").getData())).toBe("\r\nqwer\r\n\r\n");

    const vimBuf = fs.getRoot().getFile("vim.exe").getData();
    expect(vimBuf.byteLength).toBe(205718);
    expect(vimBuf.slice(0, 6)).toStrictEqual(new Uint8Array([0x4d, 0x5a, 0x96, 0x01, 0x92, 0x01]));
    expect(vimBuf.slice(-6)).toStrictEqual(new Uint8Array([0x74, 0x80, 0x00, 0x9f, 0x01, 0x1e]));
  });

  test("length", () => {
    expect(fs.getRoot().length() > 0).toBeTruthy();
    expect(fs.getRoot().getFile("kernel.sys").length()).toBe(45450);
    expect(fs.getRoot().getFile("games").length()).toBe(119704);
    expect(fs.getRoot().getFile("games/rogue.exe").length()).toBe(99584);
    expect(fs.getRoot().getFile("foo").length()).toBe(10);
  });

  test("creationTime", () => {
    expect(fs.getRoot().creationTime()).toBeNull();
    expect(fs.getRoot().getFile("kernel.sys").creationTime()).toStrictEqual(new Date(2012, 3, 7, 8, 13, 5, 500));
    expect(fs.getRoot().getFile("games").creationTime()).toStrictEqual(new Date(2013, 4, 4, 3, 29, 7, 0));
    expect(fs.getRoot().getFile("games/rogue.exe").creationTime()).toStrictEqual(new Date(2013, 4, 4, 3, 29, 7));
    expect(fs.getRoot().getFile("foo").creationTime()).toBeNull();
  });

  test("lastModified", () => {
    expect(fs.getRoot().lastModified()).toBeNull();
    expect(fs.getRoot().getFile("kernel.sys").lastModified()).toStrictEqual(new Date(2012, 3, 7, 8, 13, 0, 0));
    expect(fs.getRoot().getFile("games").lastModified()).toStrictEqual(new Date(2013, 4, 4, 3, 29, 6, 0));
    expect(fs.getRoot().getFile("games/rogue.exe").lastModified()).toStrictEqual(new Date(2012, 9, 25, 21, 19, 38, 0));
    expect(fs.getRoot().getFile("foo").lastModified()).toStrictEqual(new Date(2012, 9, 25, 20, 38, 52, 0));
  });

  test("lastAccessTime", () => {
    expect(fs.getRoot().lastAccessTime()).toBeNull();
    expect(fs.getRoot().getFile("kernel.sys").lastAccessTime()).toStrictEqual(new Date(2012, 3, 7));
    expect(fs.getRoot().getFile("games").lastAccessTime()).toStrictEqual(new Date(2013, 4, 4));
    expect(fs.getRoot().getFile("games/rogue.exe").lastAccessTime()).toStrictEqual(new Date(2012, 9, 25));
    expect(fs.getRoot().getFile("foo").lastAccessTime()).toBeNull();
  });

  test("delete", () => {
    const length = fs.getRoot().listFiles().length;

    fs.getRoot().getFile("hello.asm").delete();
    expect(fs.getRoot().listFiles().length).toBe(length - 1);

    fs.getRoot().getFile("foo").delete();
    expect(fs.getRoot().listFiles().length).toBe(length - 2);

    fs.getRoot().getFile("x86test.asm").delete();
    expect(fs.getRoot().listFiles().length).toBe(length - 3);

    const length2 = fs.getRoot().getFile("GaMeS").listFiles().length;
    expect(length2).toBe(6);
    fs.getRoot().getFile("/games/minesweeper.com").delete();
    fs.getRoot().getFile("/games/rogue.exe").delete();
    expect(fs.getRoot().getFile("GaMeS").listFiles().length).toBe(length2 - 2);

    fs.getRoot().getFile("/games").delete();
    expect(fs.getRoot().getFile("/games")).toBeNull();

    fs.getRoot().delete();
    expect(fs.getRoot().listFiles().length).toBe(0);
    const info = fs.getVolume();
    expect(info.getFreeClusters()).toBe(info.getCountOfClusters());
  });

  test("makeFile", () => {
    expect(fs.getRoot().makeFile("A.TXT").isRegularFile()).toBeTruthy();
    expect(fs.getRoot().makeDir("B.TXT").isDirectory()).toBeTruthy();
    expect(fs.getRoot().makeFile("c.txt").isRegularFile()).toBeTruthy();
    expect(fs.getRoot().makeFile("c.txt").makeDir("1")).toBeNull();
    expect(fs.getRoot().makeDir("d.txt").isDirectory()).toBeTruthy();
    expect(fs.getRoot().makeFile("/+/+/+.txt").getAbsolutePath()).toBe("/+/+/+.txt");
    expect(fs.getRoot().makeFile("/+/+/.txt").getAbsolutePath()).toBe("/+/+/.txt");
    expect(fs.getRoot().makeFile("/+/🐀/🐀.txt").getAbsolutePath()).toBe("/+/🐀/🐀.txt");
    expect(fs.getRoot().makeFile("/+/🐀/гггг.txt").getAbsolutePath()).toBe("/+/🐀/гггг.txt");
    expect(fs.getRoot().makeFile("TEST1/A.TXT").isRegularFile()).toBeTruthy();
    expect(fs.getRoot().makeDir("TEST2/B.TXT").isDirectory()).toBeTruthy();
    expect(fs.getRoot().makeFile("test3/c.txt").isRegularFile()).toBeTruthy();
    expect(fs.getRoot().makeDir("test4/d.txt").isDirectory()).toBeTruthy();
    expect(fs.getRoot().makeFile("TEST1/A1.TXT").isRegularFile()).toBeTruthy();
    expect(fs.getRoot().makeDir("TEST2/B2.TXT").isDirectory()).toBeTruthy();
    expect(fs.getRoot().makeFile("test3/c3.txt").isRegularFile()).toBeTruthy();
    expect(fs.getRoot().makeDir("test4/d4.txt").isDirectory()).toBeTruthy();
    expect(fs.getRoot().makeFile("test4/d4.txt")).toBeNull();
    expect(fs.getRoot().makeFile("a/b/c/d/e.f").isRegularFile()).toBeTruthy();
    expect(fs.getRoot().makeDir("a/b/c/d/e.f")).toBeNull();
    expect(fs.getRoot().makeDir("a/*")).toBeNull();
    expect(fs.getRoot().makeFile("a/?.txt")).toBeNull();
    const name = " .+,;=[]...";
    fs.getRoot().makeDir(name);
    const d = fs.getRoot().getFile(name);
    expect(d.isDirectory()).toBeTruthy();
  });

  test("bigDir", () => {
    const v = fs.getVolume();
    const before = v.getFreeClusters();
    const bigDir = fs.getRoot().makeDir("big");
    const clusterSize = v.getSizeOfCluster();
    const freeClusters = v.getFreeClusters();
    /* 1 cluster for dot and dotdot dirs */
    expect(freeClusters).toBe(before - 1);
    const dirCount = clusterSize / 32 - 2;
    for (let i = 0; i < dirCount - 1; i++) {
      bigDir.makeFile(String(i).padStart(4, "0"));
    }
    // no new clusters allocated
    expect(v.getFreeClusters()).toBe(freeClusters);
    // allocate SFN in last cluster
    expect(bigDir.makeFile("ONEMORE.TXT").getAbsolutePath()).toBe("/big/ONEMORE.TXT");
    expect(v.getFreeClusters()).toBe(freeClusters);
    bigDir.makeFile("ONEMORE.TXT").delete();
    // allocate LFN in last cluster + SFN on new cluster
    expect(bigDir.makeFile("onemore.txt").getAbsolutePath()).toBe("/big/onemore.txt");
    expect(fs.getRoot().getFile("big/OnEmOrE.tXt").getAbsolutePath()).toBe("/big/onemore.txt");
    expect(v.getFreeClusters()).toBe(freeClusters - 1);
    bigDir.delete();
    expect(v.getFreeClusters()).toBe(before);
  });

  test("rootDir", () => {
    const v = fs.getVolume();
    const freeClusters = v.getFreeClusters();
    const len = fs.getRoot().listFiles().length;
    let i = 0;
    const files = [];
    while (true) {
      const name = String(i++);
      const f = fs.getRoot().makeFile(name);
      if (f === null) {
        // root dir overflow
        break;
      }
      files.push(f);
    }
    // no new clusters allocated
    expect(v.getFreeClusters()).toBe(freeClusters);
    // delete all:
    for (const f of files) {
      f.delete();
    }
    expect(fs.getRoot().listFiles().length).toBe(len);
  });

  test("moveDir", () => {
    expect(fs.getRoot().moveTo("/", "/")).toBeNull();
    expect(fs.getRoot().moveTo("/", "")).toBeNull();
    expect(fs.getRoot().moveTo("", "/")).toBeNull();
    expect(fs.getRoot().moveTo("", "")).toBeNull();
    expect(fs.getRoot().moveTo("/", "/123")).toBeNull();

    fs.getRoot().makeDir("moveTest");
    fs.getRoot().makeDir("abc123");
    fs.getRoot().makeDir("abc123/subDir");
    fs.getRoot().makeFile("abc123/someFile");
    expect(fs.getRoot().getFile("notExisted")?.moveTo("/")).toBeUndefined();
    expect(fs.getRoot().getFile("notExisted/unknown")?.moveTo("/")).toBeUndefined();
    expect(fs.getRoot().getFile("invalid*name")?.moveTo("/")).toBeUndefined();
    expect(fs.getRoot().getFile("abc123").moveTo("/").getAbsolutePath()).toBe("/abc123");
    expect(fs.getRoot().getFile("abc123/subDir").moveTo("/abc123").getAbsolutePath()).toBe("/abc123/subDir");
    expect(fs.getRoot().getFile("moveTest").moveTo("invalid*name")).toBeNull();
    expect(fs.getRoot().getFile("moveTest").moveTo("abc123/invalid*name")).toBeNull();
    expect(fs.getRoot().getFile("moveTest").moveTo("abc123/invalid*name/invalid*name")).toBeNull();
    expect(fs.getRoot().getFile("moveTest").moveTo("abc123/newDir/invalid*name")).toBeNull();
    expect(fs.getRoot().getFile("moveTest").moveTo("abc123/someFile")).toBeNull();
    expect(fs.getRoot().getFile("moveTest").moveTo("abc123").getAbsolutePath()).toBe("/abc123/moveTest");
    expect(fs.getRoot().getFile("abc123").moveTo("moveRenamed").getAbsolutePath()).toBe("/moveRenamed");
    expect(fs.getRoot().getFile("moveTest")).toBeNull();
    expect(fs.getRoot().getFile("abc123")).toBeNull();
    expect(fs.getRoot().getFile("moveRenamed")).toBeDefined();

    fs.getRoot().makeDir("/d1+/d2+");
    expect(fs.getRoot().getFile("/d1+").moveTo("/D1+/D2+")).toBeNull();
    expect(fs.getRoot().getFile("/d1+/d2+").moveTo("/D1+/D3+").getAbsolutePath()).toBe("/d1+/D3+");

    fs.getRoot().makeFile("/1/2/3/4/5");
    expect(fs.getRoot().getFile("/1/2/3").moveTo("/1").getAbsolutePath()).toBe("/1/3");
    expect(fs.getRoot().getFile("/1/2").isDirectory()).toBeTruthy();
    expect(fs.getRoot().getFile("/1/2").listFiles().length).toBe(0);
    expect(fs.getRoot().getFile("/1/3/4/5").isRegularFile()).toBeTruthy();
  });

  test("moveFile", () => {
    fs.getRoot().makeFile("moveFile");
    fs.getRoot().makeDir("appleDir");
    fs.getRoot().makeFile("appleDir/dummy");
    expect(fs.getRoot().getFile("moveFile").moveTo("/").getAbsolutePath()).toBe("/moveFile");
    expect(fs.getRoot().getFile("appleDir/dummy").moveTo("/appleDir").getAbsolutePath()).toBe("/appleDir/dummy");
    expect(fs.getRoot().getFile("moveFile").moveTo("invalid*name")).toBeNull();
    expect(fs.getRoot().getFile("moveFile").moveTo("appleDir/invalid*name")).toBeNull();
    expect(fs.getRoot().getFile("moveFile").moveTo("appleDir/newDir/invalid*name")).toBeNull();
    expect(fs.getRoot().getFile("moveFile").moveTo("appleDir").getAbsolutePath()).toBe("/appleDir/moveFile");
    expect(fs.getRoot().getFile("appleDir/moveFile").moveTo("dummy")).toBeNull();
    expect(fs.getRoot().getFile("appleDir/moveFile").moveTo("dummy1").getAbsolutePath()).toBe("/appleDir/dummy1");
    expect(fs.getRoot().getFile("appleDir/dummy1").moveTo("/moveFile1").getAbsolutePath()).toBe("/moveFile1");
    expect(fs.getRoot().getFile("moveFile1").moveTo("appleDir/dummy")).toBeNull();
    expect(fs.getRoot().getFile("moveFile1").moveTo("appleDir/newFile").getAbsolutePath()).toBe("/appleDir/newFile");
  });

  test("setData", () => {
    const v = fs.getVolume();
    const f = fs.getRoot().makeFile("data.txt");
    expect(f.getAbsolutePath()).toBe("/data.txt");
    const before = v.getFreeClusters();
    expect(f.getData()).toStrictEqual(new Uint8Array(0));
    expect(f.setData(new Uint8Array([1, 2, 3])).length()).toBe(3);
    expect(f.getData()).toStrictEqual(new Uint8Array([1, 2, 3]));
    expect(v.getFreeClusters()).toBe(before - 1);

    const f2 = fs.getRoot().makeFile("data2.txt");
    const clusterSize = v.getSizeOfCluster();
    const freeClusters = v.getFreeClusters();
    const freeSpace = clusterSize * freeClusters;
    expect(f2.setData(new Uint8Array(freeSpace)).length()).toBe(freeSpace);
    expect(f2.getData()).toStrictEqual(new Uint8Array(freeSpace));
    expect(f2.setData(new Uint8Array(1))).toBeNull();
    expect(f2.getData()).toStrictEqual(new Uint8Array(freeSpace));
    expect(f2.setData(new Uint8Array()).length()).toBe(0);
    expect(v.getFreeClusters()).toBe(freeClusters);
  });
}
