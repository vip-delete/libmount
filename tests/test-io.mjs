import { expect, test } from "vitest";
import { RawDevice } from "./src/io.mjs";

export function io() {
  const img = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const device = new RawDevice(img);

  test("io-read", () => {
    device.seek(2);
    expect(device.length()).toBe(img.length);
    expect(device.readByte()).toBe(2);
    expect(device.readByte()).toBe(3);
    expect(device.readWord()).toBe(4 + (5 << 8));
    expect(device.readDoubleWord()).toBe(6 + (7 << 8) + (8 << 16) + (9 << 24));
    device.seek(4);
    expect(device.readArray(6)).toStrictEqual(new Uint8Array([4, 5, 6, 7, 8, 9]));
  });

  test("io-readDoubleWord", () => {
    const doubleWord = new RawDevice(new Uint8Array([232, 92, 201, 228])).readDoubleWord();
    expect(doubleWord).toBe(232 + (92 << 8) + (201 << 16) + ((228 << 24) >>> 0));
    expect(doubleWord).toBe((232 | (92 << 8) | (201 << 16) | (228 << 24)) >>> 0);
  });

  test("io-write", () => {
    device.seek(1);
    device.writeByte(20);
    device.skip(1);
    device.writeByte(30);
    device.writeWord(42 + (43 << 8));
    device.writeDoubleWord(44 + (45 << 8) + (46 << 16) + (47 << 24));

    device.seek(1);
    expect(device.readByte()).toBe(20);
    device.seek(3);
    expect(device.readByte()).toBe(30);
    expect(device.readWord()).toBe(42 + (43 << 8));
    expect(device.readDoubleWord()).toBe(44 + (45 << 8) + (46 << 16) + (47 << 24));

    device.seek(4);
    device.writeArray(new Uint8Array([41, 52, 63, 74, 85, 96]));

    device.seek(3);
    expect(device.readArray(5)).toStrictEqual(new Uint8Array([30, 41, 52, 63, 74]));
  });
}
