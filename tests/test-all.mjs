import { expect, test } from "vitest";
import { testFreedos722 } from "./test-freedos722.mjs";
import { testWindowsMe } from "./test-windowsme.mjs";

import { testDates } from "./test-date-utils.mjs";
import { testIO } from "./test-io.mjs";
import { testNameUtils, testNameUtils2 } from "./test-name-utils.mjs";

import { testD1 } from "./test-d1.mjs";
import { testD2 } from "./test-d2.mjs";
import { testF1 } from "./test-f1.mjs";
import { testF2 } from "./test-f2.mjs";
import { testF3 } from "./test-f3.mjs";
import { testMBR } from "./test-mbr.mjs";

export function unitTests() {
  testIO();
  testDates();
  testNameUtils();
  testNameUtils2();
}

/**
 * @param {function(Uint8Array):lmNS.Disk} mount
 */
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
  });

  testFreedos722(mount);
  testWindowsMe(mount);
  testF1(mount);
  testF2(mount);
  testF3(mount);
  testMBR(mount);
  testD1(mount);
  testD2(mount);
}
