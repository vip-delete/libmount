import { expect, test } from "vitest";
import { LFN_MAX_LEN } from "../src/const.mjs";
import { latin1 } from "../src/latin1.mjs";
import {
  getChkSum,
  normalizeLongName,
  parseDate,
  parseDateTime,
  sfnToStr,
  split,
  strToLfn,
  strToSfn,
  strToTildeName,
  toDate,
  toTime,
  toTimeTenth,
} from "../src/utils.mjs";

test("getChkSum", () => {
  expect(getChkSum(latin1.encode("HELLO   ASM"))).toBe(35);
  expect(getChkSum(latin1.encode("SIERPI~1COM"))).toBe(174);
  expect(getChkSum(latin1.encode("MISPLACECOM"))).toBe(132);
});

test("strToLfn", () => {
  expect(strToLfn("a/b")).toBeNull();
  expect(strToLfn("a\\b")).toBeNull();
  expect(strToLfn("1234567890AB")?.length).toBe(26);
  expect(strToLfn("1234567890ABC")?.length).toBe(26);
  expect(strToLfn("1234567890ABCD")?.length).toBe(52);
  const lfn1 = strToLfn("0".repeat(LFN_MAX_LEN));
  expect(lfn1?.length).toBe(520);
  expect(lfn1?.[508]).toBe("0".charCodeAt(0));
  expect(lfn1?.[509]).toBe(0);
  expect(lfn1?.[510]).toBe(0);
  expect(lfn1?.[511]).toBe(0);
  expect(lfn1?.[512]).toBe(0xff);
  expect(lfn1?.[513]).toBe(0xff);
  const lfn = strToLfn("🐀");
  expect(lfn?.length).toBe(26);
  expect(lfn?.subarray(0, 8)).toStrictEqual(new Uint8Array([0x3d, 0xd8, 0x00, 0xdc, 0, 0, 0xff, 0xff]));
});

test("normalizeLongName", () => {
  [
    //
    " abc",
    " abc    ",
    " abc....",
    " abc..  ",
    " abc ..",
    " abc. . . . .",
    " abc . . . .",
    " abc ..  .. .. ......",
  ].forEach((name) => {
    expect(normalizeLongName(name)).toBe("abc");
  });
});

test("split", () => {
  expect(split("a")).toStrictEqual(["a"]);
  expect(split("a/bc")).toStrictEqual(["a", "bc"]);
  expect(split("a\\bc")).toStrictEqual(["a", "bc"]);
  expect(split("a\\bc")).toStrictEqual(["a", "bc"]);
  expect(split("/a\\bc")).toStrictEqual(["a", "bc"]);
  expect(split("/a/bc./")).toStrictEqual(["a", "bc"]);
  expect(split("/a/./b")).toStrictEqual(["a", "b"]);
  expect(split("/a/../b")).toStrictEqual(["b"]);
  expect(split("/a/.../b")).toStrictEqual(["a", "b"]);
  expect(split("/a/../../c/./")).toStrictEqual(["c"]);
});

test("strToSfn-null", () => {
  [
    //
    "",
    "/",
    ".",
    "..",
    "AUTOEXEC.BAT1",
    "AUTOEXEC1.BAT",
    "HELLO .TXT",
    "HELLO .C ",
    "АБВГДЕЁЖ.ЗИЙ",
  ].forEach((name) => {
    expect(strToSfn(name, latin1)).toBeNull();
  });
});

test("strToSfn", () => {
  const empty = new Uint8Array(0);
  expect(sfnToStr(strToSfn("AUTOEXEC.BAT", latin1) ?? empty, latin1)).toBe("AUTOEXEC.BAT");
  expect(strToSfn("АБВГДЕЁЖЗИЙ", latin1)).toBeNull();
  expect(strToSfn("TEST", latin1)).not.toBeNull();
  expect(strToSfn(" TEST", latin1)).toBeNull();
  expect(strToSfn("TEST ", latin1)).toBeNull();
  expect(strToSfn("TE ST", latin1)).not.toBeNull();
  expect(strToSfn("TE ST", latin1)).not.toBeNull();
});

test("sfn", () => {
  [
    //
    "A",
    "AUTOEXEC.BAT",
    "AUTOEXEC.C",
    "HELLO.ASM",
    "HELLO.C",
    ".GIT",
    ".C",
    "A.B",
  ].forEach((name) => {
    const sfn = strToSfn(name, latin1);
    if (!sfn) {
      throw new Error();
    }
    expect(sfnToStr(sfn, latin1)).toBe(name);
  });
});

test("strToTildeName", () => {
  expect(strToTildeName("._.Trash", latin1, new Set())).toBe("__023D~1.TRA");
  expect(strToTildeName("sierpinski.com", latin1, new Set())).toBe("SIERPI~1.COM");

  expect(strToTildeName("+.TXT", latin1, new Set())).toBe("_0159~1.TXT");
  expect(strToTildeName("++.TXT", latin1, new Set())).toBe("__0184~1.TXT");
  expect(strToTildeName("+++.TXT", latin1, new Set())).toBe("___~1.TXT");

  expect(strToTildeName("fdos", latin1, new Set())).toBe("FDOS~1");
  expect(strToTildeName("fdos ", latin1, new Set())).toBe("FDOS ~1");
  expect(strToTildeName("fdos  ", latin1, new Set())).toBe("FDOS  ~1");
  expect(strToTildeName(" fdos", latin1, new Set())).toBe("FDOS~1");
  expect(strToTildeName("  fdos", latin1, new Set())).toBe("FDOS~1");
  expect(strToTildeName(" fdos ", latin1, new Set())).toBe("FDOS ~1");
  expect(strToTildeName("  fdos  ", latin1, new Set())).toBe("FDOS  ~1");
  expect(strToTildeName("  f do s  ", latin1, new Set())).toBe("F DO S~1");

  expect(strToTildeName("$%'-_@~`", latin1, new Set())).toBe("$%'-_@~1");
  expect(strToTildeName("!(){}^#&", latin1, new Set())).toBe("!(){}^~1");
  expect(strToTildeName("FD  O S", latin1, new Set())).toBe("FD  O ~1");
  expect(strToTildeName("+,;=[]fdos.", latin1, new Set())).toBe("______~1");

  expect(strToTildeName("The slow", latin1, new Set())).toBe("THE SL~1");
  expect(strToTildeName("The slow1", latin1, new Set())).toBe("THE SL~1");
  expect(strToTildeName("The slow1", latin1, new Set(["THE SLOW"]))).toBe("THE SL~1");
  expect(strToTildeName("The slow1", latin1, new Set(["THE SLOW", "THE SL~1"]))).toBe("THE SL~2");

  expect(strToTildeName("The slow.brown", latin1, new Set())).toBe("THE SL~1.BRO");
  expect(strToTildeName("The quick brown.fox", latin1, new Set())).toBe("THE QU~1.FOX");
  expect(strToTildeName("The quick brown.fox", latin1, new Set(["THE QU~1.FOX"]))).toBe("THE QU~2.FOX");
  expect(strToTildeName("🐀", latin1, new Set())).toBe("B43D~1");
  expect(strToTildeName("🐀.🐀", latin1, new Set())).toBe("68A8~1");
  expect(
    strToTildeName("++🐀", latin1, new Set(["__B493~1", "__B493~2", "__B493~3", "__B493~4", "__B493~5", "__B493~6", "__B493~7", "__B493~8", "__B493~9"])),
  ).toBe("__B49~10");
});

test("parseDate", () => {
  expect(parseDate(0)).toBeNull();
  expect(parseDate(0b100000_1010_11001)).toStrictEqual(new Date(1980 + 0b100000, 0b1010 - 1, 0b11001));
});

test("parseDateTime", () => {
  expect(parseDateTime(0b100000_0100_00111, 0b1000_001101_00010, 172)).toStrictEqual(
    new Date(1980 + 0b100000, 0b0100 - 1, 0b00111, 0b1000, 0b001101, 2 * 0b00010 + Math.floor(172 / 100), (172 % 100) * 10),
  );
});

test("creationTime", () => {
  expect(toDate(null)).toBe(0);
  expect(toTime(null)).toBe(0);
  expect(toTimeTenth(null)).toBe(0);
  expect(parseDate(0)).toBeNull();
  expect(parseDateTime(0, 0, 0)).toBeNull();

  const now = new Date();
  const date = toDate(now);
  const time = toTime(now);
  const timeTenth = toTimeTenth(now);

  const parsedDate = new Date(parseDate(date) ?? 0);
  expect(parsedDate.getFullYear()).toBe(now.getFullYear());
  expect(parsedDate.getMonth()).toBe(now.getMonth());
  expect(parsedDate.getDate()).toBe(now.getDate());

  const parsedDateTime = new Date(parseDateTime(date, time, timeTenth) ?? 0);
  expect(parsedDateTime.getFullYear()).toBe(now.getFullYear());
  expect(parsedDateTime.getMonth()).toBe(now.getMonth());
  expect(parsedDateTime.getDate()).toBe(now.getDate());
  expect(parsedDateTime.getHours()).toBe(now.getHours());
  expect(parsedDateTime.getMinutes()).toBe(now.getMinutes());
  expect(parsedDateTime.getSeconds()).toBe(now.getSeconds());
  expect(Math.floor(parsedDateTime.getMilliseconds() / 10)).toBe(Math.floor(now.getMilliseconds() / 10));
});
