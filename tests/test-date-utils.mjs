import { expect, test } from "vitest";
import { parseDate, parseDateTime, toDate, toTime, toTimeTenth } from "./src/date-utils.mjs";

export function testDateUtils() {
  test("parseDate", () => {
    expect(parseDate(0)).toBe(0);
    expect(parseDate(0b100000_1010_11001)).toBe(Date.UTC(1980 + 0b100000, 0b1010 - 1, 0b11001));
  });

  test("parseDateTime", () => {
    expect(parseDateTime(0b100000_0100_00111, 0b1000_001101_00010, 172)).toBe(
      Date.UTC(1980 + 0b100000, 0b0100 - 1, 0b00111) + Date.UTC(1970, 0, 1, 0b1000, 0b001101, 2 * 0b00010 + Math.floor(172 / 100), (172 % 100) * 10),
    );
  });

  test("creationTime", () => {
    const now = new Date();
    const date = toDate(now);
    const time = toTime(now);
    const timeTenth = toTimeTenth(now);

    const parsedDate = new Date(parseDate(date));
    expect(parsedDate.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(parsedDate.getUTCMonth()).toBe(now.getUTCMonth());
    expect(parsedDate.getUTCDate()).toBe(now.getUTCDate());

    const parsedDateTime = new Date(parseDateTime(date, time, timeTenth));
    expect(parsedDateTime.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(parsedDateTime.getUTCMonth()).toBe(now.getUTCMonth());
    expect(parsedDateTime.getUTCDate()).toBe(now.getUTCDate());
    expect(parsedDateTime.getUTCHours()).toBe(now.getUTCHours());
    expect(parsedDateTime.getUTCMinutes()).toBe(now.getUTCMinutes());
    expect(parsedDateTime.getUTCSeconds()).toBe(now.getUTCSeconds());
    expect(Math.floor(parsedDateTime.getUTCMilliseconds() / 10)).toBe(Math.floor(now.getUTCMilliseconds() / 10));
  });
}
