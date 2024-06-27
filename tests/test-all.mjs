import { expect, test } from "vitest";
import { freedos722 } from "./test-freedos722.mjs";

import { io } from "./test-io.mjs";
import { util } from "./test-util.mjs";

import { d1 } from "./test-d1.mjs";
import { d2 } from "./test-d2.mjs";
import { f1 } from "./test-f1.mjs";
import { f2 } from "./test-f2.mjs";
import { f3 } from "./test-f3.mjs";
import { mbr } from "./test-mbr.mjs";

export function unitTests() {
  io();
  util();
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

  freedos722(mount);
  f1(mount);
  f2(mount);
  f3(mount);
  mbr(mount);
  d1(mount);
  d2(mount);
}
