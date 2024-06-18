import { expect, test } from "vitest";
import { readFileSync } from "fs";

export function testFreedos722(mount) {
  const buf = readFileSync("src/test/resources/freedos722.img", { flag: "r" });
  const fs = mount(buf.buffer);

  test("volumeInfo", () => {
    expect(fs.getVolumeInfo()).toStrictEqual({ "type": "FAT12", "label": "FREEDOS", "id": 3838401768, "clusterSize": 1024, "freeSpace": 46080 });
  });

  test("getFile", () => {
    const root = fs.getRoot();
    expect(root.getName()).toBe("");
    expect(root.getShortName()).toBe("");
    expect(root.getLongName()).toBeNull();
    expect(root.getFileSize()).toBe(0);
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

    const files = fs.listFiles(fs.getRoot());
    expect(files.length).toBe(22);

    print(0, fs, files);
  });

  test("readFile", () => {
    const hello = fs.getFile("hello.asm");
    const helloBuf = fs.readFile(hello);
    expect(helloBuf.byteLength).toBe(163);

    const foo = fs.getFile("foo");
    const fooBuf = fs.readFile(foo);
    expect(new TextDecoder().decode(fooBuf)).toBe("\r\nqwer\r\n\r\n");

    const vim = fs.getFile("vim.exe");
    const vimBuf = fs.readFile(vim);
    expect(vimBuf.byteLength).toBe(205718);
    expect(vimBuf.slice(0, 6)).toStrictEqual(new Uint8Array([0x4d, 0x5a, 0x96, 0x01, 0x92, 0x01]));
    expect(vimBuf.slice(-6)).toStrictEqual(new Uint8Array([0x74, 0x80, 0x00, 0x9f, 0x01, 0x1e]));
  });

  test("getFileSize", () => {
    expect(fs.getRoot().getFileSize()).toBe(0);
    expect(fs.getFile("kernel.sys").getFileSize()).toBe(45450);
    expect(fs.getFile("games").getFileSize()).toBe(0);
    expect(fs.getFile("games/rogue.exe").getFileSize()).toBe(99584);
    expect(fs.getFile("foo").getFileSize()).toBe(10);
  });

  test("getCreatedDate", () => {
    expect(fs.getRoot().getCreatedDate()).toBe("");
    expect(fs.getFile("kernel.sys").getCreatedDate()).toBe("2012.04.07 08:13:05");
    expect(fs.getFile("games").getCreatedDate()).toBe("2013.05.04 03:29:07");
    expect(fs.getFile("games/rogue.exe").getCreatedDate()).toBe("2013.05.04 03:29:07");
    expect(fs.getFile("foo").getCreatedDate()).toBe("");
  });

  test("getModifiedDate", () => {
    expect(fs.getRoot().getModifiedDate()).toBe("");
    expect(fs.getFile("kernel.sys").getModifiedDate()).toBe("2012.04.07 08:13:00");
    expect(fs.getFile("games").getModifiedDate()).toBe("2013.05.04 03:29:06");
    expect(fs.getFile("games/rogue.exe").getModifiedDate()).toBe("2012.10.25 21:19:38");
    expect(fs.getFile("foo").getModifiedDate()).toBe("2012.10.25 20:38:52");
  });

  test("getAccessedDate", () => {
    expect(fs.getRoot().getAccessedDate()).toBe("");
    expect(fs.getFile("kernel.sys").getAccessedDate()).toBe("2012.04.07");
    expect(fs.getFile("games").getAccessedDate()).toBe("2013.05.04");
    expect(fs.getFile("games/rogue.exe").getAccessedDate()).toBe("2012.10.25");
    expect(fs.getFile("foo").getAccessedDate()).toBe("");
  });

  test("deleteFile", () => {
    const length = fs.listFiles(fs.getRoot()).length;
    fs.deleteFile(fs.getRoot());
    expect(fs.listFiles(fs.getRoot()).length).toBe(length);

    fs.deleteFile(fs.getFile("hello.asm"));
    expect(fs.listFiles(fs.getRoot()).length).toBe(length - 1);

    fs.deleteFile(fs.getFile("foo"));
    expect(fs.listFiles(fs.getRoot()).length).toBe(length - 2);

    fs.deleteFile(fs.getFile("x86test.asm"));
    expect(fs.listFiles(fs.getRoot()).length).toBe(length - 3);

    const length2 = fs.listFiles(fs.getFile("GaMeS")).length;
    expect(length2).toBe(6);
    fs.deleteFile(fs.getFile("/games/minesweeper.com"));
    fs.deleteFile(fs.getFile("/games/rogue.exe"));
    expect(fs.listFiles(fs.getFile("GaMeS")).length).toBe(length2 - 2);

    fs.deleteFile(fs.getFile("/games"));
    expect(fs.getFile("/games")).toBeNull();
  });

  function print(indent, fs, files) {
    files.forEach((it) => {
      console.log(" ".repeat(indent) + it.getName());
      if (it.isDirectory()) {
        print(indent + 2, fs, fs.listFiles(it));
      }
    });
  }
}
