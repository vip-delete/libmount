/**
 * @param {number} date
 * @returns {number}
 */
export function parseDate(date) {
  if (date === 0) {
    return 0;
  }
  const dayOfMonth = date & 0b11111;
  const monthOfYear = (date >> 5) & 0b1111;
  const yearSince1980 = (date >> 9) & 0b1111111;
  return Date.UTC(1980 + yearSince1980, monthOfYear - 1, dayOfMonth);
}

/**
 * @param {number} date
 * @param {number} time
 * @param {number} timeTenth
 * @returns {number}
 */
export function parseDateTime(date, time, timeTenth) {
  const millis = (timeTenth % 100) * 10;
  const seconds = Math.floor(timeTenth / 100) + ((time & 0b11111) << 1);
  const minutes = (time >> 5) & 0b111111;
  const hours = (time >> 11) & 0b11111;
  return parseDate(date) + Date.UTC(1970, 0, 1, hours, minutes, seconds, millis);
}

/**
 * @param {!Date} date
 * @returns {number}
 */
export function toDate(date) {
  const yearSince1980 = date.getFullYear() - 1980;
  const monthOfYear = date.getMonth();
  const dayOfMonth = date.getDate();
  return (yearSince1980 << 9) | (monthOfYear << 5) | dayOfMonth;
}

/**
 * @param {!Date} date
 * @returns {number}
 */
export function toTime(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return (hours << 11) | (minutes << 5) | (seconds >> 1);
}

/**
 * @param {!Date} date
 * @returns {number}
 */
export function toTimeTenth(date) {
  const seconds = date.getSeconds();
  const millis = date.getMilliseconds();
  return Math.floor(((seconds % 2) * 1000 + Number(millis)) / 10);
}
