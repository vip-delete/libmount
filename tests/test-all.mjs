import { expect, test } from "vitest";
import { freedos722 } from "./test-freedos722.mjs";
import { f1 } from "./test-f1.mjs";
import { f2 } from "./test-f2.mjs";
import { f3 } from "./test-f3.mjs";

export function testAll(mount) {
  test("general-checks", () => {
    expect(mount(new ArrayBuffer())).toBeNull();
    expect(mount(new ArrayBuffer(512))).toBeNull();
    expect(mount(new ArrayBuffer(1024000))).toBeNull();
  });

  testImages(mount);
}

function testImages(mount) {
  freedos722(mount);
  f1(mount);
  f2(mount);
  f3(mount);
}
