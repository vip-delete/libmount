import {
  DIR_NAME_LENGTH,
  LFN_ALL_NAMES_LENGTH,
  LFN_BUFFER_LEN,
  LFN_MAX_LEN,
  LFN_NAME1_LENGTH,
  LFN_NAME2_LENGTH,
  LFN_NAME3_LENGTH,
  MAX_BYTE,
  MAX_WORD,
} from "./const.mjs";
import { CHS, DirEntryLFN } from "./types.mjs";

// @ts-expect-error
// eslint-disable-next-line no-undef
const ASSERTS_ENABLED = typeof USE_ASSERTS === "boolean" ? USE_ASSERTS : true;

/**
 * @param {boolean|number} expression
 * @param {string} [msg]
 */
export const assert = (expression, msg) => {
  if (ASSERTS_ENABLED) {
    if (!expression) {
      throw new Error(msg ?? "AssertionError");
    }
  }
};

/**
 * @return {null}
 */
export const impossibleNull = () => {
  assert(false);
  return null;
};

/**
 * @param {string} str
 * @return {!Uint8Array}
 */
export const str2bytes = (str) => new Uint8Array([...str].map((/** @type {string} */ it) => it.charCodeAt(0)));

/**
 * @type {!Uint8Array}
 */
const SHORT_NAME_SPECIAL_CHARACTERS = str2bytes(" $%'-_@~`!(){}^#&");

/**
 * @type {!Uint8Array}
 */
const LONG_NAME_SPECIAL_CHARACTERS = str2bytes(".+,;=[]");

/**
 * @param {number} code
 * @return {boolean}
 */
const isCapitalLetter = (code) => code > "A".charCodeAt(0) - 1 && code < "Z".charCodeAt(0) + 1;

/**
 * @param {number} code
 * @return {boolean}
 */
const isSmallLetter = (code) => code > "a".charCodeAt(0) - 1 && code < "z".charCodeAt(0) + 1;

/**
 * @param {number} code
 * @return {boolean}
 */
const isDigit = (code) => code > "0".charCodeAt(0) - 1 && code < "9".charCodeAt(0) + 1;

/**
 * @param {number} code
 * @return {boolean}
 */
const isUnicode = (code) => code > 255;

/**
 * @param {number} code
 * @return {boolean}
 */
const isExtended = (code) => code > 127;

/**
 * @param {!Uint8Array} sfn
 * @return {number}
 */
export const getChkSum = (sfn) => {
  assert(sfn.length === DIR_NAME_LENGTH);
  let sum = sfn[0];
  for (let i = 1, len = sfn.length; i < len; i++) {
    sum = (((sum << 7) | (sum >> 1)) + sfn[i]) & 0xff;
  }
  return sum;
};

/**
 * @param {number} code
 * @return {boolean}
 */
export const isShortNameValidCode = (code) => {
  assert(code >= 0 && code <= MAX_BYTE);
  return isExtended(code) || isCapitalLetter(code) || isDigit(code) || SHORT_NAME_SPECIAL_CHARACTERS.includes(code);
};

/**
 * @param {number} wcCode
 * @return {boolean}
 */
const isLongNameValidCode = (wcCode) => {
  assert(wcCode >= 0 && wcCode <= MAX_WORD);
  return isUnicode(wcCode) || isSmallLetter(wcCode) || isShortNameValidCode(wcCode) || LONG_NAME_SPECIAL_CHARACTERS.includes(wcCode);
};

/**
 * @param {string} longName
 * @return {string}
 */
export const normalizeLongName = (longName) => {
  // return longName.replace(/[\s.]*$/gu, "").trim();
  let i = 0;
  while (i < longName.length && longName.charCodeAt(i) === " ".charCodeAt(0)) {
    i++;
  }
  let j = longName.length - 1;
  // eslint-disable-next-line init-declarations
  let ch;
  while (j >= i && ((ch = longName.charCodeAt(j)) === " ".charCodeAt(0) || ch === ".".charCodeAt(0))) {
    j--;
  }
  return longName.slice(i, j + 1);
};

/**
 * @param {string} path
 * @return {!Array<string>}
 */
export const split = (path) => {
  const names = [];
  const parts = path.split(/[/\\]/u);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part !== "" && part !== ".") {
      if (part === "..") {
        if (names.length) {
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
};

/**
 * @param {!Uint8Array} sfn
 * @param {!ns.Codepage} cp
 * @return {string}
 */
export const sfnToStr = (sfn, cp) => {
  assert(sfn.length === DIR_NAME_LENGTH);
  const str = cp.decode(sfn);
  const basename = str.slice(0, 8).trimEnd();
  const ext = str.slice(8, 11).trimEnd();
  return ext === "" ? basename : basename + "." + ext;
};

/**
 * @param {!Uint8Array} sfn
 * @param {number} offset
 * @param {number} len
 * @param {!ns.Codepage} cp
 * @param {string} str
 * @return {boolean}
 */
const appendToSFN = (sfn, offset, len, cp, str) => {
  if (str.startsWith(" ") || str.endsWith(" ")) {
    // invalid
    return false;
  }
  let i = 0;
  const buf = cp.encode(str);
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
};

/**
 * @param {string} str
 * @param {!ns.Codepage} codepage
 * @return {?Uint8Array}
 */
export const strToSfn = (str, codepage) => {
  const i = str.lastIndexOf(".");
  const basename = i < 0 ? str : str.substring(0, i);
  const ext = i < 0 ? "" : str.substring(i + 1);
  if (basename === "" && ext === "") {
    // both are empty
    return null;
  }
  const sfn = new Uint8Array(DIR_NAME_LENGTH);
  if (!appendToSFN(sfn, 0, 8, codepage, basename)) {
    // filename is not valid for short name
    return null;
  }
  if (!appendToSFN(sfn, 8, 3, codepage, ext)) {
    // ext is not valid for short name
    return null;
  }
  return sfn;
};

const LFN_BUFFER = new Uint8Array(LFN_BUFFER_LEN);

/**
 * @param {string} str
 * @return {?Uint8Array}
 */
export const strToLfn = (str) => {
  assert(str.length && str.length <= LFN_MAX_LEN);
  const lfn = LFN_BUFFER;
  let i = 0;
  let j = 0;
  while (i < str.length) {
    let ch = str.charCodeAt(i++);
    if (!isLongNameValidCode(ch)) {
      // invalid char
      return null;
    }
    lfn[j++] = ch; // & 0xff;
    ch >>= 8;
    lfn[j++] = ch; // & 0xff;
  }
  // A name that fits exactly in a set of long name directory entries
  // (i.e. is an integer multiple of 13) is not NULL terminated and not padded with 0xFFFF.
  if (j % LFN_ALL_NAMES_LENGTH !== 0) {
    // NULL-terminator
    lfn[j++] = 0;
    lfn[j++] = 0;
    // 0xFF padding
    while (j % LFN_ALL_NAMES_LENGTH !== 0) {
      lfn[j++] = MAX_BYTE;
      lfn[j++] = MAX_BYTE;
    }
  }
  assert(j <= lfn.length);
  return lfn.subarray(0, j);
};

const LFN_DECODE_BUFFER = new Uint16Array(LFN_BUFFER_LEN / 2);

/**
 * @param {!Array<!DirEntryLFN>} chain
 * @return {string}
 */
export const lfnToStr = (chain) => {
  assert(chain.length > 0);
  const buf = LFN_DECODE_BUFFER;
  let len = 0;
  let k = chain.length - 1;
  // eslint-disable-next-line init-declarations
  let ch;
  do {
    const item = chain[k--];
    const Name1 = item.Name1;
    let i = 0;
    while (i < LFN_NAME1_LENGTH && (ch = Name1[i++] | (Name1[i++] << 8))) {
      buf[len++] = ch;
    }
    if (ch) {
      const Name2 = item.Name2;
      i = 0;
      while (i < LFN_NAME2_LENGTH && (ch = Name2[i++] | (Name2[i++] << 8))) {
        buf[len++] = ch;
      }
      if (ch) {
        const Name3 = item.Name3;
        i = 0;
        while (i < LFN_NAME3_LENGTH && (ch = Name3[i++] | (Name3[i++] << 8))) {
          buf[len++] = ch;
        }
      }
    }
  } while (ch && k >= 0);
  return String.fromCharCode(...buf.subarray(0, len));
};

/**
 * @param {string} str
 * @param {number} max
 * @param {!ns.Codepage} cp
 * @return {string}
 */
const toValidShortNameCharacters = (str, max, cp) => {
  let ret = "";
  let i = 0;
  let count = 0;
  while (i < str.length && count < max) {
    const ch = str.charAt(i);
    // skip leading spaces
    if (ret !== "" || ch !== " ") {
      const buf = cp.encode(ch);
      // check 1st byte only
      const code = buf[0];
      // ignore all characters encoded as "?" as they are "unmapped"
      if (code !== "?".charCodeAt(0)) {
        if (isShortNameValidCode(code)) {
          // character is "mapped" and 1st byte is valid for SFN
          ret += ch;
          // encoding can be multi-byte
          count += buf.length;
        } else {
          // replace all "mapped" but invalid for SFN characters by "_"
          ret += "_";
          count++;
        }
      }
    }
    i++;
  }
  return ret;
};

/**
 * @param {string} str
 * @return {string}
 */
const strToHash = (str) => {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum = (sum + str.charCodeAt(i)) & 0xffff;
  }
  return sum.toString(16).padStart(4, "0").toUpperCase();
};

/**
 * @param {string} str
 * @param {!ns.Codepage} cp
 * @param {!Set<string>} fileNames
 * @return {string}
 */
export const strToTildeName = (str, cp, fileNames) => {
  str = str.toUpperCase();
  const i = str.lastIndexOf(".");
  const basename = i < 0 ? str : str.substring(0, i);
  const ext = i < 0 ? "" : str.substring(i + 1);

  const basename6 = toValidShortNameCharacters(basename, 6, cp);
  const ext3 = toValidShortNameCharacters(ext, 3, cp);

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
  // namespace overflow is impossible
  return "";
};

// Dates

/**
 * @param {number} date
 * @return {?Date}
 */
export const parseDate = (date) => {
  if (!date) {
    return null;
  }
  const dayOfMonth = date & 0b11111;
  const monthOfYear = (date >> 5) & 0b1111;
  const yearSince1980 = (date >> 9) & 0b1111111;
  return new Date(1980 + yearSince1980, Math.max(0, monthOfYear - 1), Math.max(1, dayOfMonth));
};

/**
 * @param {number} date
 * @param {number} time
 * @param {number} timeTenth
 * @return {?Date}
 */
export const parseDateTime = (date, time, timeTenth) => {
  if (!date) {
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
};

/**
 * @param {?Date} date
 * @return {number}
 */
export const toDate = (date) => {
  if (!date) {
    return 0;
  }
  const yearSince1980 = date.getFullYear() - 1980;
  const monthOfYear = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  return (yearSince1980 << 9) | (monthOfYear << 5) | dayOfMonth;
};

/**
 * @param {?Date} date
 * @return {number}
 */
export const toTime = (date) => {
  if (!date) {
    return 0;
  }
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return (hours << 11) | (minutes << 5) | (seconds >> 1);
};

/**
 * @param {?Date} date
 * @return {number}
 */
export const toTimeTenth = (date) => {
  if (!date) {
    return 0;
  }
  const seconds = date.getSeconds();
  const millis = date.getMilliseconds();
  return Math.floor(((seconds % 2) * 1000 + Number(millis)) / 10);
};

/**
 * @param {!ns.Codepage} cp
 * @param {number} len
 * @param {?string} str
 * @return {!Uint8Array}
 */
export const strToUint8Array = (cp, len, str) => {
  const data = new Uint8Array(len).fill(" ".charCodeAt(0));
  if (str) {
    data.set(cp.encode(str.substring(0, len)).subarray(0, len));
  }
  return data;
};

/**
 * @param {!CHS} chs
 * @param {number} TH
 * @param {number} TS
 * @return {number}
 */
export const chs2lba = (chs, TH, TS) => (chs.Cylinder * TH + chs.Head) * TS + (chs.Sector - 1);

/**
 * @param {number} LBA
 * @param {number} TH
 * @param {number} TS
 * @return {!CHS}
 */
export const lba2chs = (LBA, TH, TS) => {
  const Cylinder = Math.floor(LBA / (TS * TH));
  const i = Cylinder * TH * TS;
  const Head = Math.floor((LBA - i) / TS);
  const j = Head * TS;
  const Sector = LBA - i - j + 1;
  return {
    Cylinder,
    Head,
    Sector,
  };
};
