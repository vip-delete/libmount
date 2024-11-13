/* eslint-disable sort-imports */
import { expect, test } from "vitest";
import { testFreedos722 } from "./test-freedos722.mjs";

import { testCodepages } from "./test-codepages.mjs";
import { testIO } from "./test-io.mjs";
import { testDateUtils } from "./test-date-utils.mjs";
import { testNameUtils, testNameUtils2 } from "./test-name-utils.mjs";

import { testD1 } from "./test-d1.mjs";
import { testD2 } from "./test-d2.mjs";
import { testF1 } from "./test-f1.mjs";
import { testF2 } from "./test-f2.mjs";
import { testF3 } from "./test-f3.mjs";
import { testMBR } from "./test-mbr.mjs";

export function unitTests() {
  testCodepages();
  testIO();
  testDateUtils();
  testNameUtils();
  testNameUtils2();
}

export function integrationTests(mount) {
  test("general-checks", () => {
    const buf = [
      //
      new ArrayBuffer(),
      new ArrayBuffer(512),
      new ArrayBuffer(1024000),
    ];
    for (let i = 0; i < buf.length; i++) {
      const disk = mount(new Uint8Array(buf[i]));
      expect(disk.getFileSystem()).toBeNull();
      expect(disk.getPartitions().length).toBe(0);
    }

    expect(mount(new Uint8Array(), "_".repeat(0))).toBeDefined();
    expect(mount(new Uint8Array(), "_".repeat(128))).toBeDefined();
    expect(mount(new Uint8Array(), "_".repeat(256))).toBeDefined();
  });

  testFreedos722(mount);
  testF1(mount);
  testF2(mount);
  testF3(mount);
  testMBR(mount);
  testD1(mount);
  testD2(mount);
}
