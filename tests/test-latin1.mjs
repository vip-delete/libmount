import { expect, test } from "vitest";
import { latin1 } from "../src/latin1.mjs";

test("latin1", () => {
  const arr = new Uint8Array(256);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = i;
  }
  const chars = String.fromCharCode(...arr);
  expect(latin1.encode(chars)).toStrictEqual(arr);
  expect(latin1.decode(arr)).toBe(chars);

  const buf = latin1.encode("A 😀 B");
  expect(buf).toStrictEqual(new Uint8Array([65, 32, 63, 63, 32, 66]));
  expect(latin1.decode(buf)).toBe("A ?? B");
});
