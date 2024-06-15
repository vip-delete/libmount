import { readFileSync } from "fs";
import { expect, test } from "vitest";
import LibMount from "dist/libmount.min.mjs";

const buf = readFileSync("src/test/resources/freedos722.img", { flag: "r" });
const fs = LibMount.mount(buf.buffer);

test("mount", () => {
  const root = fs.getRoot();
  expect(root.getName()).toBe("");
  expect(root.getAbsolutePath()).toBe("/");

  const kernel = fs.getFile("kernel.sys");
  expect(kernel.getName()).toBe("KERNEL.SYS");
  expect(kernel.getAbsolutePath()).toBe("/KERNEL.SYS");

  const games = fs.getFile("GAMES");
  expect(games.getName()).toBe("games");
  expect(games.getAbsolutePath()).toBe("/games");

  const games1 = fs.getFile("/GAMES");
  expect(games1.getName()).toBe("games");
  expect(games1.getAbsolutePath()).toBe("/games");

  const games2 = fs.getFile("/GaMeS");
  expect(games2.getName()).toBe("games");
  expect(games2.getAbsolutePath()).toBe("/games");

  const minesweeper = fs.getFile("/games/MiNeSw~1.COM");
  expect(minesweeper.getName()).toBe("minesweeper.com");
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

function print(indent, fs, files) {
  files.forEach((it) => {
    console.log(" ".repeat(indent) + it.getName());
    if (it.isDirectory()) {
      print(indent + 2, fs, fs.listFiles(it));
    }
  });
}
