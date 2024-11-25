import { expect, test } from "vitest";
import { parseDate, parseDateTime, toDate, toTime, toTimeTenth } from "./src/date-utils.mjs";

export function testDateUtils() {
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
    const now = new Date();
    const date = toDate(now);
    const time = toTime(now);
    const timeTenth = toTimeTenth(now);

    const parsedDate = new Date(parseDate(date));
    expect(parsedDate.getFullYear()).toBe(now.getFullYear());
    expect(parsedDate.getMonth()).toBe(now.getMonth());
    expect(parsedDate.getDate()).toBe(now.getDate());

    const parsedDateTime = new Date(parseDateTime(date, time, timeTenth));
    expect(parsedDateTime.getFullYear()).toBe(now.getFullYear());
    expect(parsedDateTime.getMonth()).toBe(now.getMonth());
    expect(parsedDateTime.getDate()).toBe(now.getDate());
    expect(parsedDateTime.getHours()).toBe(now.getHours());
    expect(parsedDateTime.getMinutes()).toBe(now.getMinutes());
    expect(parsedDateTime.getSeconds()).toBe(now.getSeconds());
    expect(Math.floor(parsedDateTime.getMilliseconds() / 10)).toBe(Math.floor(now.getMilliseconds() / 10));
  });
}
