import { expect, test } from "vitest";
import { cp1251, cp1252 } from "./src/charmap.mjs";
import { getChkSum, decode, encode, getShortName, isShortNameValid, parseDate, parseDateTime } from "./src/util.mjs";

export function util() {
  test("decode", () => {
    expect(decode(new Uint8Array("HELLO   ASM".split("").map((it) => it.charCodeAt(0))), cp1251)).toBe("HELLO   ASM");
    expect(decode(new Uint8Array([72, 69, 76, 76, 79, 32, 32, 32, 65, 83, 77]), cp1251)).toBe("HELLO   ASM");
    expect(decode(new Uint8Array([224, 225, 226, 227, 228, 229, 184, 230, 231, 232, 233]), cp1251)).toBe("абвгдеёжзий");
    expect(decode(new Uint8Array([1, 127]), cp1251)).toBe("☺⌂");
    expect(decode(encode("Превед Medved!", cp1251), cp1251)).toBe("Превед Medved!");
    expect(decode(encode("Превед Medved!", cp1252), cp1252)).toBe("______ Medved!");
  });

  test("encode", () => {
    expect(encode("HELLO   ASM", cp1252)).toStrictEqual(new Uint8Array([72, 69, 76, 76, 79, 32, 32, 32, 65, 83, 77]));
    expect(encode("абвгдеёжзий", cp1251)).toStrictEqual(new Uint8Array([224, 225, 226, 227, 228, 229, 184, 230, 231, 232, 233]));
  });

  test("getChkSum", () => {
    expect(getChkSum(encode("HELLO   ASM", cp1252), cp1252)).toBe(35);
    expect(getChkSum(encode("SIERPI~1COM", cp1252), cp1252)).toBe(174);
    expect(getChkSum(encode("MISPLACECOM", cp1252), cp1252)).toBe(132);
  });

  test("getShortName", () => {
    expect(getShortName(new Uint8Array([72, 69, 76, 76, 79, 32, 32, 32, 65, 32, 32]), cp1252)).toBe("HELLO.A");
    expect(getShortName(new Uint8Array(['.'.charCodeAt(0), 32, 32, 32, 32, 32, 32, 32, 32, 32, 32]), cp1252)).toBe(".");
  });

  test("isNameValid", () => {
    expect(isShortNameValid(encode("HELLO   ASM", cp1251))).toBeTruthy();
    expect(isShortNameValid(encode(" $%'-_@~`!(){}^#&", cp1251))).toBeTruthy();
    expect(isShortNameValid(encode("/", cp1252))).toBeFalsy();
    expect(isShortNameValid(encode("/", cp1251))).toBeFalsy();
    expect(isShortNameValid(encode("\\", cp1251))).toBeFalsy();
  });

  test("parseDate", () => {
    expect(parseDate(0)).toBe(0);
    expect(parseDate(0b100000_1010_11001)).toBe(Date.UTC(1980 + 0b100000, 0b1010 - 1, 0b11001));
    expect(parseDateTime(0b100000_0100_00111, 0b1000_001101_00010, 172)).toBe(
      Date.UTC(1980 + 0b100000, 0b0100 - 1, 0b00111) + Date.UTC(1970, 0, 1, 0b1000, 0b001101, 2 * 0b00010 + Math.floor(172 / 100), (172 % 100) * 10),
    );
  });
}
