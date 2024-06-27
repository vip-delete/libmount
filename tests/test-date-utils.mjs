import { expect, test } from "vitest";
import { parseDate, parseDateTime } from "./src/date-utils.mjs";

export function dateUtils() {
  test("parseDate", () => {
    expect(parseDate(0)).toBe(0);
    expect(parseDate(0b100000_1010_11001)).toBe(Date.UTC(1980 + 0b100000, 0b1010 - 1, 0b11001));
  });

  test("parseDateTime", () => {
    expect(parseDateTime(0b100000_0100_00111, 0b1000_001101_00010, 172)).toBe(
      Date.UTC(1980 + 0b100000, 0b0100 - 1, 0b00111) + Date.UTC(1970, 0, 1, 0b1000, 0b001101, 2 * 0b00010 + Math.floor(172 / 100), (172 % 100) * 10),
    );
  });
}
