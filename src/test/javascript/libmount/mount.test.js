import { readFileSync } from "fs";
import { expect, test } from "vitest";
import LibMount from "dist/libmount.min.mjs";

const buf = readFileSync("src/test/resources/freedos722.img", { flag: "r" });

test("mount", () => {
  const fs = LibMount.mount(buf.buffer);
  const kernel = fs.getFile("kernel.sys");
  expect(kernel.getAbsolutePath()).toBe("/KERNEL.SYS");

  const minesweeper = fs.getFile("/games/minesw~1.com");
  expect(minesweeper.getName()).toBe("minesweeper.com");

  const files = fs.listFiles(fs.getRoot());
  expect(files.length).toBe(22);

  print(0, fs, files);
});

function print(indent, fs, files) {
  files.forEach((it) => {
    console.log(" ".repeat(indent) + it.getName());
    if (it.isDirectory()) {
      print(indent + 2, fs, fs.listFiles(it));
    }
  });
}
