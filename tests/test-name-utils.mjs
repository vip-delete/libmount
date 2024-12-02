import { expect, test } from "vitest";
import { LATIN1 } from "../src/latin1.mjs";
import { getChkSum, normalizeLongName, sfnToStr, split, strToLfn, strToSfn, strToTildeName } from "../src/utils.mjs";

export function testNameUtils() {
  test("getChkSum", () => {
    expect(getChkSum(LATIN1.encode("HELLO   ASM"))).toBe(35);
    expect(getChkSum(LATIN1.encode("SIERPI~1COM"))).toBe(174);
    expect(getChkSum(LATIN1.encode("MISPLACECOM"))).toBe(132);
  });

  test("strToLfn", () => {
    expect(strToLfn("")).toBeNull();
    expect(strToLfn("0".repeat(256))).toBeNull();
    expect(strToLfn("a/b")).toBeNull();
    expect(strToLfn("a\\b")).toBeNull();
    expect(strToLfn("🐀")).toStrictEqual(new Uint8Array([0x3d, 0xd8, 0x00, 0xdc]));
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
      expect(strToSfn(name, LATIN1)).toBeNull();
    });
  });

  test("strToSfn", () => {
    expect(strToSfn("AUTOEXEC.BAT", LATIN1)).toBeDefined();
    expect(strToSfn("АБВГДЕЁЖЗИЙ", LATIN1)).toBeDefined();
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
      const sfn = strToSfn(name, LATIN1);
      if (sfn === null) {
        throw new Error();
      }
      expect(sfnToStr(sfn, LATIN1)).toBe(name);
    });
  });
}

export function testNameUtils2() {
  test("strToTildeName", () => {
    expect(strToTildeName("._.Trash", LATIN1, new Set())).toBe("__02BD~1.TRA");
    expect(strToTildeName("sierpinski.com", LATIN1, new Set())).toBe("SIERPI~1.COM");

    expect(strToTildeName("+.TXT", LATIN1, new Set())).toBe("_0159~1.TXT");
    expect(strToTildeName("++.TXT", LATIN1, new Set())).toBe("__0184~1.TXT");
    expect(strToTildeName("+++.TXT", LATIN1, new Set())).toBe("___~1.TXT");

    expect(strToTildeName("fdos", LATIN1, new Set())).toBe("FDOS~1");
    expect(strToTildeName("fdos ", LATIN1, new Set())).toBe("FDOS ~1");
    expect(strToTildeName("fdos  ", LATIN1, new Set())).toBe("FDOS  ~1");
    expect(strToTildeName(" fdos", LATIN1, new Set())).toBe("FDOS~1");
    expect(strToTildeName("  fdos", LATIN1, new Set())).toBe("FDOS~1");
    expect(strToTildeName(" fdos ", LATIN1, new Set())).toBe("FDOS ~1");
    expect(strToTildeName("  fdos  ", LATIN1, new Set())).toBe("FDOS  ~1");
    expect(strToTildeName("  f do s  ", LATIN1, new Set())).toBe("F DO S~1");

    expect(strToTildeName("$%'-_@~`", LATIN1, new Set())).toBe("$%'-_@~1");
    expect(strToTildeName("!(){}^#&", LATIN1, new Set())).toBe("!(){}^~1");
    expect(strToTildeName("FD  O S", LATIN1, new Set())).toBe("FD  O ~1");
    expect(strToTildeName("+,;=[]fdos.", LATIN1, new Set())).toBe("______~1");

    expect(strToTildeName("The slow", LATIN1, new Set())).toBe("THE SL~1");
    expect(strToTildeName("The slow1", LATIN1, new Set())).toBe("THE SL~1");
    expect(strToTildeName("The slow1", LATIN1, new Set(["THE SLOW"]))).toBe("THE SL~1");
    expect(strToTildeName("The slow1", LATIN1, new Set(["THE SLOW", "THE SL~1"]))).toBe("THE SL~2");

    expect(strToTildeName("The slow.brown", LATIN1, new Set())).toBe("THE SL~1.BRO");
    expect(strToTildeName("The quick brown.fox", LATIN1, new Set())).toBe("THE QU~1.FOX");
    expect(strToTildeName("The quick brown.fox", LATIN1, new Set(["THE QU~1.FOX"]))).toBe("THE QU~2.FOX");
    expect(strToTildeName("🐀", LATIN1, new Set())).toBe("B43D~1");
    expect(strToTildeName("🐀.🐀", LATIN1, new Set())).toBe("68A8~1");
    expect(
      strToTildeName("++🐀", LATIN1, new Set(["__B493~1", "__B493~2", "__B493~3", "__B493~4", "__B493~5", "__B493~6", "__B493~7", "__B493~8", "__B493~9"])),
    ).toBe("__B49~10");
  });
}
