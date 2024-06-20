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
function isCharValid(ch) {
  return ch > 127 || isCapital(ch) || isDigit(ch) || " $%'-_@~`!(){}^#&".includes(String.fromCharCode(ch));
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
 * @param {string} encoding
 * @returns {string}
 */
export function getRawName(arr, encoding) {
  return new TextDecoder(encoding).decode(arr).trimEnd();
}

/**
 * @param {!Uint8Array} arr
 * @param {string} encoding
 * @returns {string}
 */
export function getShortName(arr, encoding) {
  const filename = getRawName(arr.subarray(0, 8), encoding);
  const ext = getRawName(arr.subarray(8, 11), encoding);
  return filename + (ext === "" ? "" : "." + ext);
}

/**
 * @param {number} date
 * @returns {string}
 */
export function formatDate(date) {
  const dayOfMonth = date & 0b11111;
  const monthOfYear = (date >> 5) & 0b1111;
  const yearSince1980 = (date >> 9) & 0b1111111;
  return 1980 + yearSince1980 + "." + padStart2(monthOfYear) + "." + padStart2(dayOfMonth);
}

/**
 * @param {number} time
 * @param {number} timeTenth
 * @returns {string}
 */
export function formatTime(time, timeTenth) {
  // const millis = (timeTenth % 100) * 10;
  const seconds = Math.floor(timeTenth / 100) + ((time & 0b11111) << 1);
  const minutes = (time >> 5) & 0b111111;
  const hours = (time >> 11) & 0b11111;
  return padStart2(hours) + ":" + padStart2(minutes) + ":" + padStart2(seconds);
}

/**
 * @param {number} date
 * @param {number} time
 * @param {number} timeTenth
 * @returns {string}
 */
export function formatDateTime(date, time, timeTenth) {
  const dateStr = formatDate(date);
  const timeStr = formatTime(time, timeTenth);
  return dateStr + " " + timeStr;
}

/**
 * @param {number} num
 * @returns {string}
 */
function padStart2(num) {
  return num.toString().padStart(2, "0");
}
