import { expect, test } from "vitest";
import { createIO } from "../src/io.mjs";

const img = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
const io = createIO(img);

test("io-read", () => {
  io.seek(2);
  expect(io.len()).toBe(img.length);
  expect(io.readByte()).toBe(2);
  expect(io.readByte()).toBe(3);
  expect(io.readWord()).toBe(4 + (5 << 8));
  expect(io.readDoubleWord()).toBe(6 + (7 << 8) + (8 << 16) + (9 << 24));
  io.seek(4);
  expect(io.readUint8Array(6)).toStrictEqual(new Uint8Array([4, 5, 6, 7, 8, 9]));
});

test("io-readDoubleWord", () => {
  const doubleWord = createIO(new Uint8Array([232, 92, 201, 228])).readDoubleWord();
  expect(doubleWord).toBe(232 + (92 << 8) + (201 << 16) + ((228 << 24) >>> 0));
  expect(doubleWord).toBe((232 | (92 << 8) | (201 << 16) | (228 << 24)) >>> 0);
});

test("io-write", () => {
  io.seek(1);
  io.writeByte(20);
  io.skip(1);
  io.writeByte(30);
  io.writeWord(42 + (43 << 8));
  io.writeDoubleWord(44 + (45 << 8) + (46 << 16) + (47 << 24));

  io.seek(1);
  expect(io.readByte()).toBe(20);
  io.seek(3);
  expect(io.readByte()).toBe(30);
  expect(io.readWord()).toBe(42 + (43 << 8));
  expect(io.readDoubleWord()).toBe(44 + (45 << 8) + (46 << 16) + (47 << 24));

  io.seek(4);
  io.writeUint8Array(new Uint8Array([41, 52, 63, 74, 85, 96]));

  io.seek(3);
  expect(io.readUint8Array(5)).toStrictEqual(new Uint8Array([30, 41, 52, 63, 74]));
});
