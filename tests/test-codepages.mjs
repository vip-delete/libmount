import { bestfit1251, bestfit1252, cp1251, cp1252, cp437, cp850 } from "./src/codepages/codepages.mjs";
import { expect, test } from "vitest";

export function testCodepages() {
  test("basic-tests", () => {
    const codepages = [
      //
      cp437,
      cp850,
      cp1251,
      cp1252,
      bestfit1251,
      bestfit1252,
    ];
    for (let i = 0; i < codepages.length; i++) {
      const c = codepages[i];
      expect(c.decode(c.encode("HELLO   ASM"))).toBe("HELLO   ASM");
    }
  });

  test("encodeChar", () => {
    expect(cp1251.encodeChar("\u0435".charCodeAt(0))).toBe(0xe5);
    expect(cp1251.encodeChar("Ё".charCodeAt(0))).toBe(168);
    expect(cp1252.encodeChar("Ё".charCodeAt(0))).toBeNull();
  });

  test("decode-cp1251", () => {
    expect(cp1251.decode(new Uint8Array([224, 225, 226, 227, 228, 229, 184, 230, 231, 232, 233]))).toBe("абвгдеёжзий");
    expect(cp1251.decode(new Uint8Array([1, 127]))).toBe("\u0001\u007f");
    expect(cp1251.decode(cp1251.encode("Превед Medved!"))).toBe("Превед Medved!");
  });

  test("decode-cp1252", () => {
    expect(cp1252.decode(new Uint8Array([".".charCodeAt(0), 32, 32, 32, 32, 32, 32, 32, 32, 32, 32])).trimEnd()).toBe(".");
    expect(cp1252.decode(new Uint8Array([72, 69, 76, 76, 79, 32, 32, 32, 65, 32, 32])).trimEnd()).toBe("HELLO   A");
    expect(cp1252.decode(new Uint8Array([72, 69, 76, 76, 79, 32, 32, 32, 65, 83, 77]))).toBe("HELLO   ASM");
    expect(cp1252.decode(new Uint8Array([224, 225, 226, 227, 228, 229, 184, 230, 231, 232, 233]))).toBe("àáâãäå¸æçèé");
    expect(cp1252.decode(new Uint8Array([1, 127]))).toBe("\u0001\u007f");
    expect(cp1252.decode(cp1252.encode("Превед Medved!"))).toBe("______ Medved!");
  });

  test("encode", () => {
    expect(cp1252.encode("HELLO   ASM")).toStrictEqual(new Uint8Array([72, 69, 76, 76, 79, 32, 32, 32, 65, 83, 77]));
    expect(cp1251.encode("абвгдеёжзий")).toStrictEqual(new Uint8Array([224, 225, 226, 227, 228, 229, 184, 230, 231, 232, 233]));
  });
}
