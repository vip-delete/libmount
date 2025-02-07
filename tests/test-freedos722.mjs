/* eslint-disable complexity */
import { mount } from "libmount";
import { expect, test } from "vitest";
import { readBinaryFileSync } from "../scripts/commons.mjs";
import { LFN_MAX_LEN } from "../src/const.mjs";
import { latin1 } from "../src/latin1.mjs";

const buffer = readBinaryFileSync("images/freedos722.img");
const disk = mount(new Uint8Array(buffer));
expect(disk.capacity()).toBe(buffer.length);
const fs = disk.getFileSystem();
if (!fs) {
  throw new Error();
}

test("general-checks", () => {
  const buf = [
    //
    new ArrayBuffer(),
    new ArrayBuffer(512),
    new ArrayBuffer(1024000),
  ];
  for (let i = 0; i < buf.length; i++) {
    const disk1 = mount(new Uint8Array(buf[i]));
    expect(disk1.getFileSystem()).toBeNull();
    expect(disk1.getPartitions().length).toBe(0);
  }
});

test("getVolume", () => {
  expect(fs.getName()).toBe("FAT12");
  expect(fs.getLabel()).toBe("FREEDOS");
  expect(fs.getOEMName()).toBe("FreeDOS");
  expect(fs.getId()).toBe(3838401768);
  expect(fs.getSizeOfCluster()).toBe(1024);
  expect(fs.getCountOfClusters()).toBe(713);
  expect(fs.getFreeClusters()).toBe(45);
});

test("getRoot", () => {
  [fs.getRoot(), fs.getRoot().getFile("/"), fs.getRoot().getFile("\\"), fs.getRoot().getFile("//"), fs.getRoot().getFile("\\\\////")].forEach((root) => {
    expect(root?.getName()).toBe("");
    expect(root?.getShortName()).toBe("");
    expect(root?.isRegularFile()).toBeFalsy();
    expect(root?.isDirectory()).toBeTruthy();
    expect(root?.getAbsolutePath()).toBe("/");
    expect(root?.getLastModified()).toBeNull();
    expect(root?.getCreationTime()).toBeNull();
    expect(root?.getLastAccessTime()).toBeNull();
    expect(root?.open()).toBeNull();
    expect(root?.length()).toBeGreaterThan(0);
  });
});

test("getSizeOnDisk", () => {
  expect(fs.getRoot().length()).toBe(658675);
  expect(fs.getRoot().getSizeOnDisk()).toBe((fs.getCountOfClusters() - fs.getFreeClusters()) * fs.getSizeOfCluster());
});

test("getFile", () => {
  const kernel = fs.getRoot().getFile("kernel.sys");
  expect(kernel?.getName()).toBe("KERNEL.SYS");
  expect(kernel?.getShortName()).toBe("KERNEL.SYS");
  expect(kernel?.isRegularFile()).toBeTruthy();
  expect(kernel?.isDirectory()).toBeFalsy();
  expect(kernel?.getAbsolutePath()).toBe("/KERNEL.SYS");

  const games = fs.getRoot().getFile("\\\\GAMES");
  expect(games?.getName()).toBe("games");
  expect(games?.getShortName()).toBe("GAMES");
  expect(games?.isRegularFile()).toBeFalsy();
  expect(games?.isDirectory()).toBeTruthy();
  expect(games?.getAbsolutePath()).toBe("/games");

  const games1 = fs.getRoot().getFile("/GAMES");
  expect(games1?.getName()).toBe("games");
  expect(games1?.getAbsolutePath()).toBe("/games");

  const games2 = fs.getRoot().getFile("////GaMeS");
  expect(games2?.getName()).toBe("games");
  expect(games2?.getAbsolutePath()).toBe("/games");

  const minesweeper = games2?.getFile("MiNeSw~1.COM//");
  expect(minesweeper?.getName()).toBe("minesweeper.com");
  expect(minesweeper?.getShortName()).toBe("MINESW~1.COM");
  expect(minesweeper?.isRegularFile()).toBeTruthy();
  expect(minesweeper?.isDirectory()).toBeFalsy();
  expect(minesweeper?.getAbsolutePath()).toBe("/games/minesweeper.com");

  expect(minesweeper?.findFirst(() => true)).toBeNull();
  expect(minesweeper?.findAll(() => true)).toBeNull();

  expect(fs.getRoot().listFiles()?.length).toBe(22);
  expect(
    fs
      .getRoot()
      ?.findFirst((it) => it.length() > 1000 && it.length() < 10000)
      ?.getName(),
  ).toBe("README");
  expect(fs.getRoot().findAll((it) => it.length() > 1000 && it.length() < 10000)?.length).toBe(6);
});

test("getData", () => {
  const games = fs.getRoot().getFile("games");
  expect(games?.isDirectory()).toBeTruthy();
  expect(games?.open()).toBeNull();

  expect(fs.getRoot().getFile("hello.asm")?.open()?.readData()?.byteLength).toBe(163);
  expect(new TextDecoder().decode(fs.getRoot().getFile("foo")?.open()?.readData() ?? new Uint8Array([0]))).toBe("\r\nqwer\r\n\r\n");

  const vimBuf = fs.getRoot().getFile("vim.exe")?.open()?.readData();
  expect(vimBuf?.byteLength).toBe(205718);
  expect(vimBuf?.slice(0, 6)).toStrictEqual(new Uint8Array([0x4d, 0x5a, 0x96, 0x01, 0x92, 0x01]));
  expect(vimBuf?.slice(-6)).toStrictEqual(new Uint8Array([0x74, 0x80, 0x00, 0x9f, 0x01, 0x1e]));
});

test("length", () => {
  expect(fs.getRoot().length() > 0).toBeTruthy();
  expect(fs.getRoot().getFile("kernel.sys")?.length()).toBe(45450);
  expect(fs.getRoot().getFile("games")?.length()).toBe(119704);
  expect(fs.getRoot().getFile("games/rogue.exe")?.length()).toBe(99584);
  expect(fs.getRoot().getFile("foo")?.length()).toBe(10);
});

test("creationTime", () => {
  expect(fs.getRoot().getCreationTime()).toBeNull();
  expect(fs.getRoot().getFile("kernel.sys")?.getCreationTime()).toStrictEqual(new Date(2012, 3, 7, 8, 13, 5, 500));
  expect(fs.getRoot().getFile("games")?.getCreationTime()).toStrictEqual(new Date(2013, 4, 4, 3, 29, 7, 0));
  expect(fs.getRoot().getFile("games/rogue.exe")?.getCreationTime()).toStrictEqual(new Date(2013, 4, 4, 3, 29, 7));
  expect(fs.getRoot().getFile("foo")?.getCreationTime()).toBeNull();
  fs.getRoot()
    .getFile("kernel.sys")
    ?.setCreationTime(new Date(2025, 2, 14));
  expect(fs.getRoot().getFile("kernel.sys")?.getCreationTime()).toStrictEqual(new Date(2025, 2, 14));
  fs.getRoot().getFile("kernel.sys")?.setCreationTime(null);
  expect(fs.getRoot().getFile("kernel.sys")?.getCreationTime()).toBeNull();
});

test("lastModified", () => {
  expect(fs.getRoot().getLastModified()).toBeNull();
  expect(fs.getRoot().getFile("kernel.sys")?.getLastModified()).toStrictEqual(new Date(2012, 3, 7, 8, 13, 0, 0));
  expect(fs.getRoot().getFile("games")?.getLastModified()).toStrictEqual(new Date(2013, 4, 4, 3, 29, 6, 0));
  expect(fs.getRoot().getFile("games/rogue.exe")?.getLastModified()).toStrictEqual(new Date(2012, 9, 25, 21, 19, 38, 0));
  expect(fs.getRoot().getFile("foo")?.getLastModified()).toStrictEqual(new Date(2012, 9, 25, 20, 38, 52, 0));
  fs.getRoot()
    .getFile("kernel.sys")
    ?.setLastModified(new Date(2025, 7, 14));
  expect(fs.getRoot().getFile("kernel.sys")?.getLastModified()).toStrictEqual(new Date(2025, 7, 14));
  fs.getRoot().getFile("kernel.sys")?.setLastModified(null);
  expect(fs.getRoot().getFile("kernel.sys")?.getLastModified()).toBeNull();
});

test("lastAccessTime", () => {
  expect(fs.getRoot().getLastAccessTime()).toBeNull();
  expect(fs.getRoot().getFile("kernel.sys")?.getLastAccessTime()).toStrictEqual(new Date(2012, 3, 7));
  expect(fs.getRoot().getFile("games")?.getLastAccessTime()).toStrictEqual(new Date(2013, 4, 4));
  expect(fs.getRoot().getFile("games/rogue.exe")?.getLastAccessTime()).toStrictEqual(new Date(2012, 9, 25));
  expect(fs.getRoot().getFile("foo")?.getLastAccessTime()).toBeNull();
  fs.getRoot()
    .getFile("kernel.sys")
    ?.setLastAccessTime(new Date(2025, 11, 19));
  expect(fs.getRoot().getFile("kernel.sys")?.getLastAccessTime()).toStrictEqual(new Date(2025, 11, 19));
  fs.getRoot().getFile("kernel.sys")?.setLastAccessTime(null);
  expect(fs.getRoot().getFile("kernel.sys")?.getLastAccessTime()).toBeNull();
});

test("delete", () => {
  const length = fs.getRoot().listFiles()?.length ?? -1;

  fs.getRoot().getFile("hello.asm")?.delete();
  expect(fs.getRoot().listFiles()?.length).toBe(length - 1);

  fs.getRoot().getFile("foo")?.delete();
  expect(fs.getRoot().listFiles()?.length).toBe(length - 2);

  fs.getRoot().getFile("x86test.asm")?.delete();
  expect(fs.getRoot().listFiles()?.length).toBe(length - 3);

  const length2 = fs.getRoot().getFile("GaMeS")?.listFiles()?.length ?? -1;
  expect(length2).toBe(6);
  fs.getRoot().getFile("/games/minesweeper.com")?.delete();
  fs.getRoot().getFile("/games/rogue.exe")?.delete();
  expect(fs.getRoot().getFile("GaMeS")?.listFiles()?.length).toBe(length2 - 2);

  fs.getRoot().getFile("/games")?.delete();
  expect(fs.getRoot().getFile("/games")).toBeNull();

  fs.getRoot().delete();
  expect(fs.getRoot().listFiles()?.length).toBe(0);
  expect(fs.getFreeClusters()).toBe(fs.getCountOfClusters());
});

test("makeFile", () => {
  expect(fs.getRoot().makeFile("A.TXT")?.isRegularFile()).toBeTruthy();
  expect(fs.getRoot().makeDir("B.TXT")?.isDirectory()).toBeTruthy();
  expect(fs.getRoot().makeFile("c.txt")?.isRegularFile()).toBeTruthy();
  expect(fs.getRoot().makeFile("c.txt")?.makeDir("1")).toBeNull();
  expect(fs.getRoot().makeDir("d.txt")?.isDirectory()).toBeTruthy();
  expect(fs.getRoot().makeFile("/+/+/+.txt")?.getAbsolutePath()).toBe("/+/+/+.txt");
  expect(fs.getRoot().makeFile("/+/+/.txt")?.getAbsolutePath()).toBe("/+/+/.txt");
  expect(fs.getRoot().makeFile("/+/🐀/🐀.txt")?.getAbsolutePath()).toBe("/+/🐀/🐀.txt");
  expect(fs.getRoot().makeFile("/+/🐀/гггг.txt")?.getAbsolutePath()).toBe("/+/🐀/гггг.txt");
  expect(fs.getRoot().makeFile("TEST1/A.TXT")?.isRegularFile()).toBeTruthy();
  expect(fs.getRoot().makeDir("TEST2/B.TXT")?.isDirectory()).toBeTruthy();
  expect(fs.getRoot().makeFile("test3/c.txt")?.isRegularFile()).toBeTruthy();
  expect(fs.getRoot().makeDir("test4/d.txt")?.isDirectory()).toBeTruthy();
  expect(fs.getRoot().makeFile("TEST1/A1.TXT")?.isRegularFile()).toBeTruthy();
  expect(fs.getRoot().makeDir("TEST2/B2.TXT")?.isDirectory()).toBeTruthy();
  expect(fs.getRoot().makeFile("test3/c3.txt")?.isRegularFile()).toBeTruthy();
  expect(fs.getRoot().makeDir("test4/d4.txt")?.isDirectory()).toBeTruthy();
  expect(fs.getRoot().makeFile("test4/d4.txt")).toBeNull();
  expect(fs.getRoot().makeFile("a/b/c/d/e.f")?.isRegularFile()).toBeTruthy();
  expect(fs.getRoot().makeDir("a/b/c/d/e.f")).toBeNull();
  expect(fs.getRoot().makeDir("a/*")).toBeNull();
  expect(fs.getRoot().makeFile("a/?.txt")).toBeNull();
  const name = " .+,;=[]...";
  fs.getRoot().makeDir(name);
  const dir = fs.getRoot().getFile(name);
  expect(dir?.isDirectory()).toBeTruthy();
});

test("bigDir", () => {
  const before = fs.getFreeClusters();
  const bigDir = fs.getRoot().makeDir("big");
  const clusterSize = fs.getSizeOfCluster();
  const freeClusters = fs.getFreeClusters();
  /* 1 cluster for dot and dotdot dirs */
  expect(freeClusters).toBe(before - 1);
  const dirCount = clusterSize / 32 - 2;
  for (let i = 0; i < dirCount - 1; i++) {
    bigDir?.makeFile(String(i).padStart(4, "0"));
  }
  // no new clusters allocated
  expect(fs.getFreeClusters()).toBe(freeClusters);
  // allocate SFN in last cluster
  expect(bigDir?.makeFile("ONEMORE.TXT")?.getAbsolutePath()).toBe("/big/ONEMORE.TXT");
  expect(fs.getFreeClusters()).toBe(freeClusters);
  bigDir?.makeFile("ONEMORE.TXT")?.delete();
  // allocate LFN in last cluster + SFN on new cluster
  expect(bigDir?.makeFile("onemore.txt")?.getAbsolutePath()).toBe("/big/onemore.txt");
  expect(fs.getRoot().getFile("big/OnEmOrE.tXt")?.getAbsolutePath()).toBe("/big/onemore.txt");
  expect(fs.getFreeClusters()).toBe(freeClusters - 1);
  bigDir?.delete();
  expect(fs.getFreeClusters()).toBe(before);
});

test("rootDir", () => {
  const freeClusters = fs.getFreeClusters();
  const len = fs.getRoot().listFiles()?.length;
  let i = 0;
  const files = [];
  while (true) {
    const name = String(i++);
    const file = fs.getRoot().makeFile(name);
    if (!file) {
      // root dir overflow
      break;
    }
    files.push(file);
  }
  // no new clusters allocated
  expect(fs.getFreeClusters()).toBe(freeClusters);
  // delete all:
  for (const file of files) {
    file.delete();
  }
  expect(fs.getRoot().listFiles()?.length).toBe(len);
});

test("moveDir", () => {
  expect(fs.getRoot().moveTo("/")).toBeNull();
  expect(fs.getRoot().moveTo("")).toBeNull();
  expect(fs.getRoot().moveTo("/123")).toBeNull();

  fs.getRoot().makeDir("moveTest");
  fs.getRoot().makeDir("abc123");
  fs.getRoot().makeDir("abc123/subDir");
  fs.getRoot().makeFile("abc123/someFile");
  expect(fs.getRoot().getFile("notExisted")?.moveTo("/")).toBeUndefined();
  expect(fs.getRoot().getFile("notExisted/unknown")?.moveTo("/")).toBeUndefined();
  expect(fs.getRoot().getFile("invalid*name")?.moveTo("/")).toBeUndefined();
  expect(fs.getRoot().getFile("abc123")?.moveTo("/")?.getAbsolutePath()).toBe("/abc123");
  expect(fs.getRoot().getFile("abc123/subDir")?.moveTo("/abc123")?.getAbsolutePath()).toBe("/abc123/subDir");
  expect(fs.getRoot().getFile("moveTest")?.moveTo("invalid*name")).toBeNull();
  expect(fs.getRoot().getFile("moveTest")?.moveTo("abc123/invalid*name")).toBeNull();
  expect(fs.getRoot().getFile("moveTest")?.moveTo("abc123/invalid*name/invalid*name")).toBeNull();
  expect(fs.getRoot().getFile("moveTest")?.moveTo("abc123/newDir/invalid*name")).toBeNull();
  expect(fs.getRoot().getFile("moveTest")?.moveTo("abc123/someFile")).toBeNull();
  expect(fs.getRoot().getFile("moveTest")?.moveTo("abc123")?.getAbsolutePath()).toBe("/abc123/moveTest");
  expect(fs.getRoot().getFile("abc123")?.moveTo("moveRenamed")?.getAbsolutePath()).toBe("/moveRenamed");
  expect(fs.getRoot().getFile("moveTest")).toBeNull();
  expect(fs.getRoot().getFile("abc123")).toBeNull();
  expect(fs.getRoot().getFile("moveRenamed")).not.toBeNull();

  fs.getRoot().makeDir("/d1+/d2+");
  expect(fs.getRoot().getFile("/d1+")?.moveTo("/D1+/D2+")).toBeNull();
  expect(fs.getRoot().getFile("/d1+/d2+")?.moveTo("/D1+/D3+")?.getAbsolutePath()).toBe("/d1+/D3+");

  fs.getRoot().makeFile("/1/2/3/4/5");
  expect(fs.getRoot().getFile("/1/2/3")?.moveTo("/1")?.getAbsolutePath()).toBe("/1/3");
  expect(fs.getRoot().getFile("/1/2")?.isDirectory()).toBeTruthy();
  expect(fs.getRoot().getFile("/1/2")?.listFiles()?.length).toBe(0);
  expect(fs.getRoot().getFile("/1/3/4/5")?.isRegularFile()).toBeTruthy();
});

test("moveFile", () => {
  fs.getRoot().makeFile("moveFile");
  fs.getRoot().makeDir("appleDir");
  fs.getRoot().makeFile("appleDir/dummy");
  expect(fs.getRoot().getFile("moveFile")?.moveTo("/")?.getAbsolutePath()).toBe("/moveFile");
  expect(fs.getRoot().getFile("appleDir/dummy")?.moveTo("/appleDir")?.getAbsolutePath()).toBe("/appleDir/dummy");
  expect(fs.getRoot().getFile("moveFile")?.moveTo("invalid*name")).toBeNull();
  expect(fs.getRoot().getFile("moveFile")?.moveTo("appleDir/invalid*name")).toBeNull();
  expect(fs.getRoot().getFile("moveFile")?.moveTo("appleDir/newDir/invalid*name")).toBeNull();
  expect(fs.getRoot().getFile("moveFile")?.moveTo("appleDir")?.getAbsolutePath()).toBe("/appleDir/moveFile");
  expect(fs.getRoot().getFile("appleDir/moveFile")?.moveTo("dummy")).toBeNull();
  expect(fs.getRoot().getFile("appleDir/moveFile")?.moveTo("dummy1")?.getAbsolutePath()).toBe("/appleDir/dummy1");
  expect(fs.getRoot().getFile("appleDir/dummy1")?.moveTo("/moveFile1")?.getAbsolutePath()).toBe("/moveFile1");
  expect(fs.getRoot().getFile("moveFile1")?.moveTo("appleDir/dummy")).toBeNull();
  expect(fs.getRoot().getFile("moveFile1")?.moveTo("appleDir/newFile")?.getAbsolutePath()).toBe("/appleDir/newFile");
});

test("FileIO-skipClus", () => {
  const content = latin1.encode("Hello World!".repeat(100));
  const name = "FILE-IO.TXT";
  fs.getRoot().makeFile(name)?.open()?.writeData(content);
  const file = fs.getRoot().getFile(name);
  expect(file).not.toBeNull();
  if (file) {
    const data = new Uint8Array(file.length());
    const io = file.open();
    expect(io).not.toBeNull();
    if (io) {
      // eslint-disable-next-line init-declarations
      let len;
      let tmp = data;
      while ((len = io.readClus(tmp))) {
        tmp = tmp.subarray(len);
      }
    }
    expect(data).toStrictEqual(content);
  }
});

test("FileIO-readClus", () => {
  const content = latin1.encode("Hello World!".repeat(100));
  const name = "FILE-IO.TXT";
  fs.getRoot().makeFile(name)?.open()?.writeData(content);
  const file = fs.getRoot().getFile(name);
  expect(file).not.toBeNull();
  if (file) {
    const data = new Uint8Array(file.length());
    const io = file.open();
    expect(io).not.toBeNull();
    if (io) {
      // eslint-disable-next-line init-declarations
      let len;
      let tmp = data;
      while ((len = io.readClus(tmp))) {
        tmp = tmp.subarray(len);
      }
    }
    expect(data).toStrictEqual(content);
  }
});

test("FileIO-writeClus", () => {
  const name = "FILE-IO2.TXT";
  const file = fs.getRoot().makeFile(name);
  expect(file).not.toBeNull();
  if (file) {
    let io = file.open();
    expect(io).not.toBeNull();
    const content = latin1.encode("Hello World!".repeat(100));
    if (io) {
      const expectedFreeClusters = fs.getFreeClusters() - Math.ceil(content.length / fs.getSizeOfCluster());
      // eslint-disable-next-line init-declarations
      let len;
      let tmp = content;
      while (tmp.length && (len = io.writeClus(tmp))) {
        tmp = tmp.subarray(len);
      }
      expect(tmp.length).toBe(0); // non zero means can't write (no space left)
      expect(fs.getFreeClusters()).toBe(expectedFreeClusters);
      expect(fs.getRoot().getFile(name)?.length()).toStrictEqual(content.length);
      expect(fs.getRoot().getFile(name)?.open()?.readData()).toStrictEqual(content);
    }

    io = file.open();
    expect(io).not.toBeNull();
    const newContent = latin1.encode("Tail Cluster");
    if (io) {
      // override the first bytes of the 1st cluster of the file
      // The rest file is not changed
      io.writeClus(newContent);
      content.set(newContent);
      expect(fs.getRoot().getFile(name)?.length()).toStrictEqual(content.length);
      expect(fs.getRoot().getFile(name)?.open()?.readData()).toStrictEqual(content);

      // override the first bytes of the 2nd cluster of the file
      // The rest file is not changed
      io.writeClus(newContent);
      content.set(newContent, fs.getSizeOfCluster());
      expect(fs.getRoot().getFile(name)?.length()).toStrictEqual(content.length);
      expect(fs.getRoot().getFile(name)?.open()?.readData()).toStrictEqual(content);

      // allocated 3rd cluster, set new bytes, update FileSize
      // the bytes between content.length and 3rd cluster are undefined
      io.writeClus(newContent);
      expect(fs.getRoot().getFile(name)?.length()).toStrictEqual(2 * fs.getSizeOfCluster() + newContent.length);
    }
  }
});

test("setData-1", () => {
  const file = fs.getRoot().makeFile("data.txt");
  expect(file?.getAbsolutePath()).toBe("/data.txt");
  const before = fs.getFreeClusters();
  expect(file?.open()?.readData()).toStrictEqual(new Uint8Array(0));
  const buf = new Uint8Array([1, 2, 3]);
  expect(file?.open()?.writeData(buf)).toBe(3);
  expect(file?.open()?.readData()).toStrictEqual(buf);
  expect(fs.getFreeClusters()).toBe(before - 1);
});

test("setData-2", { timeout: 20000 }, () => {
  const f2 = fs.getRoot().makeFile("data2.txt");
  const clusterSize = fs.getSizeOfCluster();
  const freeClusters = fs.getFreeClusters();
  const freeSpace = clusterSize * freeClusters;
  const buf = new Uint8Array(freeSpace + 1);
  buf[0] = 1;
  buf[1024] = 2;
  buf[10240] = 3;
  expect(f2?.open()?.writeData(buf)).toBe(freeSpace);
  expect(f2?.open()?.readData()?.length).toBe(freeSpace);
  expect(f2?.open()?.readData()).toStrictEqual(buf.subarray(0, freeSpace));
  expect(f2?.open()?.writeData(new Uint8Array(1))).toBe(1);
  expect(f2?.length()).toBe(1);
  expect(f2?.open()?.writeData(new Uint8Array())).toBe(0);
  expect(fs.getFreeClusters()).toBe(freeClusters);
});

test("maxLFN-1", () => {
  const name = "0".repeat(LFN_MAX_LEN);
  expect(fs.getRoot().makeFile(name)).not.toBeNull();
  expect(fs.getRoot().makeFile(name + "A")).toBeNull();
  const file = fs.getRoot().findAll((it) => it.getName().startsWith(name));
  expect(file).not.toBeNull();
  expect(file?.length).toBe(1);
  expect(file?.[0].getName()).toBe(name);
  file?.[0]?.delete();
});

test("maxLFN-2", () => {
  const name = "🐀".repeat(127) + "A"; // 255 UTF-16 codepoints
  const file1 = fs.getRoot().makeFile(name);
  expect(file1).not.toBeNull();
  const f2 = fs.getRoot().makeFile(name + "B");
  expect(f2).toBeNull();
  const files = fs.getRoot().listFiles();
  expect(files).not.toBeNull();
  const file2 = fs.getRoot().findAll((it) => it.getName().startsWith(name));
  expect(file2).not.toBeNull();
  expect(file2?.length).toBe(1);
  expect(file2?.[0].getName()).toBe(name);
  file2?.[0]?.delete();
});
