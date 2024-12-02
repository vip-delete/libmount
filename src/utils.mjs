import { assert, impossibleNull } from "./support.mjs";

const SHORT_NAME_SPECIAL_CHARACTERS = [
  " ".charCodeAt(0),
  "$".charCodeAt(0),
  "%".charCodeAt(0),
  "'".charCodeAt(0),
  "-".charCodeAt(0),
  "_".charCodeAt(0),
  "@".charCodeAt(0),
  "~".charCodeAt(0),
  "`".charCodeAt(0),
  "!".charCodeAt(0),
  "(".charCodeAt(0),
  ")".charCodeAt(0),
  "{".charCodeAt(0),
  "}".charCodeAt(0),
  "^".charCodeAt(0),
  "#".charCodeAt(0),
  "&".charCodeAt(0),
];

const LONG_NAME_SPECIAL_CHARACTERS = [
  ".".charCodeAt(0),
  "+".charCodeAt(0),
  ",".charCodeAt(0),
  ";".charCodeAt(0),
  "=".charCodeAt(0),
  "[".charCodeAt(0),
  "]".charCodeAt(0),
];

/**
 * @param {number} code
 * @returns {boolean}
 */
function isCapitalLetter(code) {
  return code >= "A".charCodeAt(0) && code <= "Z".charCodeAt(0);
}

/**
 * @param {number} code
 * @returns {boolean}
 */
function isSmallLetter(code) {
  return code >= "a".charCodeAt(0) && code <= "z".charCodeAt(0);
}

/**
 * @param {number} code
 * @returns {boolean}
 */
function isDigit(code) {
  return code >= "0".charCodeAt(0) && code <= "9".charCodeAt(0);
}

/**
 * @param {number} code
 * @returns {boolean}
 */
function isUnicode(code) {
  return code > 255;
}

/**
 * @param {number} code
 * @returns {boolean}
 */
function isExtended(code) {
  return code > 127;
}

/**
 * @param {!Uint8Array} sfn
 * @returns {number}
 */
export function getChkSum(sfn) {
  assert(sfn.length === 11);
  return sfn.reduce((/** @type {number} */ acc, /** @type {number} */ curr) => (((acc & 1) << 7) + (acc >> 1) + curr) & 0xff, 0);
}

/**
 * @param {number} code
 * @returns {boolean}
 */
export function isShortNameValidCode(code) {
  assert(code >= 0 && code <= 0xff);
  return isExtended(code) || isCapitalLetter(code) || isDigit(code) || SHORT_NAME_SPECIAL_CHARACTERS.includes(code);
}

/**
 * @param {number} wcCode
 * @returns {boolean}
 */
export function isLongNameValidCode(wcCode) {
  assert(wcCode >= 0 && wcCode <= 0xffff);
  return isUnicode(wcCode) || isSmallLetter(wcCode) || isShortNameValidCode(wcCode) || LONG_NAME_SPECIAL_CHARACTERS.includes(wcCode);
}

/**
 * @param {string} longName
 * @returns {string}
 */
export function normalizeLongName(longName) {
  // remove trim and remove trailing dots
  return longName.replace(/[\s.]*$/gu, "").trim();
}

/**
 * @param {string} path
 * @returns {!Array<string>}
 */
export function split(path) {
  const names = [];
  const parts = path.split(/[/\\]/u);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part !== "" && part !== ".") {
      if (part === "..") {
        if (names.length > 0) {
          names.length--;
        }
      } else {
        const name = normalizeLongName(part);
        if (name !== "") {
          names.push(name);
        }
      }
    }
  }
  return names;
}

/**
 * @param {!Uint8Array} sfn
 * @param {!lmNS.Encoding} encoding
 * @returns {string}
 */
export function sfnToStr(sfn, encoding) {
  assert(sfn.length === 11);
  const str = encoding.decode(sfn);
  const basename = str.slice(0, 8).trimEnd();
  const ext = str.slice(8, 11).trimEnd();
  return ext === "" ? basename : basename + "." + ext;
}

/**
 * @param {string} str
 * @param {!lmNS.Encoding} encoding
 * @returns {?Uint8Array}
 */
export function strToSfn(str, encoding) {
  const i = str.lastIndexOf(".");
  const basename = i < 0 ? str : str.substring(0, i);
  const ext = i < 0 ? "" : str.substring(i + 1);
  if (basename === "" && ext === "") {
    // both are empty
    return null;
  }
  const sfn = new Uint8Array(11);
  if (!appendToSFN(sfn, 0, 8, encoding, basename)) {
    // filename is not valid for short name
    return null;
  }
  if (!appendToSFN(sfn, 8, 3, encoding, ext)) {
    // ext is not valid for short name
    return null;
  }
  return sfn;
}

/**
 * @param {!Uint8Array} sfn
 * @param {number} offset
 * @param {number} len
 * @param {!lmNS.Encoding} encoding
 * @param {string} str
 * @returns {boolean}
 */
function appendToSFN(sfn, offset, len, encoding, str) {
  if (str.startsWith(" ") || str.endsWith(" ")) {
    // invalid
    return false;
  }
  let i = 0;
  const buf = encoding.encode(str);
  if (buf.length > len) {
    // too long
    return false;
  }
  while (i < buf.length) {
    const code = buf[i];
    if (!isShortNameValidCode(code)) {
      // invalid char
      return false;
    }
    sfn[offset + i] = code;
    i++;
  }
  // pad with spaces
  while (i < len) {
    sfn[offset + i] = " ".charCodeAt(0);
    i++;
  }
  return true;
}

/**
 * @param {string} str
 * @returns {?Uint8Array}
 */
export function strToLfn(str) {
  if (str === "") {
    // too short
    return null;
  }
  if (str.length > 255) {
    // too long
    return null;
  }
  const lfn = new Uint8Array(str.length * 2);
  let i = 0;
  while (i < str.length) {
    const wcCode = str.charCodeAt(i);
    if (!isLongNameValidCode(wcCode)) {
      // invalid char
      return null;
    }
    const low = wcCode & 0xff;
    const high = wcCode >> 8;
    lfn[2 * i] = low;
    lfn[2 * i + 1] = high;
    i++;
  }
  return lfn;
}

/**
 * @param {string} str
 * @param {!lmNS.Encoding} encoding
 * @param {!Set<string>} fileNames
 * @returns {?string}
 */
export function strToTildeName(str, encoding, fileNames) {
  const i = str.lastIndexOf(".");
  const basename = i < 0 ? str : str.substring(0, i);
  const ext = i < 0 ? "" : str.substring(i + 1);

  const basename6 = toValidShortNameCharacters(basename.toUpperCase(), 6, encoding);
  const ext3 = toValidShortNameCharacters(ext.toUpperCase(), 3, encoding);

  assert(!basename6.startsWith(" ") && basename6.length <= 6);
  assert(!ext3.startsWith(" ") && ext3.length <= 3);

  const prefix = basename6.length > 2 ? basename6 : basename6 + strToHash(str);
  const postfix = ext3 === "" ? "" : "." + ext3;

  let num = 1;
  let numLen = 1;
  while (numLen <= 7) {
    const filename = prefix.substring(0, 7 - numLen) + "~" + num + postfix;
    if (!fileNames.has(filename)) {
      return filename;
    }
    num++;
    numLen = num.toString().length;
  }
  return impossibleNull();
}

/**
 * @param {string} str
 * @param {number} max
 * @param {!lmNS.Encoding} encoding
 * @returns {string}
 */
function toValidShortNameCharacters(str, max, encoding) {
  let ret = "";
  let i = 0;
  const buf = encoding.encode(str);
  while (i < str.length && ret.length < max) {
    const ch = str.charAt(i);
    const code = buf[i];
    // ignore all characters encoded as "?": they are "unmapped"
    if (code !== "?".charCodeAt(0)) {
      if (isShortNameValidCode(code)) {
        // character is "mapped" and valid for SFN, append to ret but skip leading spaces
        const leadingSpace = ch === " " && ret === "";
        if (!leadingSpace) {
          ret += ch;
        }
      } else {
        // replace all "mapped" but invalid for SFN characters by "_"
        ret += "_";
      }
    }
    i++;
  }
  return ret;
}

/**
 * @param {string} str
 * @returns {string}
 */
function strToHash(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum = (sum + str.charCodeAt(i)) & 0xffff;
  }
  return sum.toString(16).padStart(4, "0").toUpperCase();
}

// Dates

/**
 * @param {number} date
 * @returns {?Date}
 */
export function parseDate(date) {
  if (date === 0) {
    return null;
  }
  const dayOfMonth = date & 0b11111;
  const monthOfYear = (date >> 5) & 0b1111;
  const yearSince1980 = (date >> 9) & 0b1111111;
  return new Date(1980 + yearSince1980, Math.max(0, monthOfYear - 1), Math.max(1, dayOfMonth));
}

/**
 * @param {number} date
 * @param {number} time
 * @param {number} timeTenth
 * @returns {?Date}
 */
export function parseDateTime(date, time, timeTenth) {
  if (date === 0) {
    return null;
  }
  const dayOfMonth = date & 0b11111;
  const monthOfYear = (date >> 5) & 0b1111;
  const yearSince1980 = (date >> 9) & 0b1111111;
  const millis = (timeTenth % 100) * 10;
  const seconds = Math.floor(timeTenth / 100) + ((time & 0b11111) << 1);
  const minutes = (time >> 5) & 0b111111;
  const hours = (time >> 11) & 0b11111;
  return new Date(1980 + yearSince1980, Math.max(0, monthOfYear - 1), Math.max(1, dayOfMonth), hours, minutes, seconds, millis);
}

/**
 * @param {!Date} date
 * @returns {number}
 */
export function toDate(date) {
  const yearSince1980 = date.getFullYear() - 1980;
  const monthOfYear = date.getMonth() + 1;
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
