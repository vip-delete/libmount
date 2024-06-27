/**
 * @param {number} ch
 * @returns {boolean}
 */
function isCapital(ch) {
  return ch >= "A".charCodeAt(0) && ch <= "Z".charCodeAt(0);
}

/**
 * @param {number} ch
 * @returns {boolean}
 */
function isDigit(ch) {
  return ch >= "0".charCodeAt(0) && ch <= "9".charCodeAt(0);
}

/**
 * @param {number} ch
 * @returns {boolean}
 */
function isCharValidAscii(ch) {
  return isCapital(ch) || isDigit(ch) || " $%'-_@~`!(){}^#&".includes(String.fromCharCode(ch));
}

/**
 * @param {number} ch
 * @returns {boolean}
 */
function isCharValid(ch) {
  return ch > 127 || isCharValidAscii(ch);
}

/**
 * @param {!Uint8Array} arr
 * @returns {boolean}
 */
export function isNameValid(arr) {
  return arr.every(isCharValid);
}

/**
 * @param {!Uint8Array} arr
 * @returns {number}
 */
export function getChkSum(arr) {
  return arr.reduce((/** @type {number} */ acc, /** @type {number} */ curr) => (((acc & 1) << 7) + (acc >> 1) + curr) & 0xff, 0);
}

/**
 * @param {!Uint8Array} arr
 * @param {string} codepage
 * @returns {string}
 */
export function getRawName(arr, codepage) {
  return new TextDecoder(codepage).decode(arr).trimEnd();
}

/**
 * @param {!Uint8Array} arr
 * @param {string} codepage
 * @returns {string}
 */
export function getShortName(arr, codepage) {
  const filename = getRawName(arr.subarray(0, 8), codepage);
  const ext = getRawName(arr.subarray(8, 11), codepage);
  return filename + (ext === "" ? "" : "." + ext);
}

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
