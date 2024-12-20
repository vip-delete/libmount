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
 * @param {!lm.Codepage} codepage
 * @returns {string}
 */
export function sfnToStr(sfn, codepage) {
  assert(sfn.length === 11);
  const str = codepage.decode(sfn);
  const basename = str.slice(0, 8).trimEnd();
  const ext = str.slice(8, 11).trimEnd();
  return ext === "" ? basename : basename + "." + ext;
}

/**
 * @param {string} str
 * @param {!lm.Codepage} codepage
 * @returns {?Uint8Array}
 */
export function strToSfn(str, codepage) {
  const i = str.lastIndexOf(".");
  const basename = i < 0 ? str : str.substring(0, i);
  const ext = i < 0 ? "" : str.substring(i + 1);
  if (basename === "" && ext === "") {
    // both are empty
    return null;
  }
  const sfn = new Uint8Array(11);
  if (!appendToSFN(sfn, 0, 8, codepage, basename)) {
    // filename is not valid for short name
    return null;
  }
  if (!appendToSFN(sfn, 8, 3, codepage, ext)) {
    // ext is not valid for short name
    return null;
  }
  return sfn;
}

/**
 * @param {!Uint8Array} sfn
 * @param {number} offset
 * @param {number} len
 * @param {!lm.Codepage} codepage
 * @param {string} str
 * @returns {boolean}
 */
function appendToSFN(sfn, offset, len, codepage, str) {
  if (str.length > len) {
    // too long
    return false;
  }
  if (str.startsWith(" ") || str.endsWith(" ")) {
    // invalid
    return false;
  }
  let i = 0;
  while (i < str.length) {
    const wcCode = str.charCodeAt(i);
    const code = codepage.encodeChar(wcCode);
    if (code === null) {
      // can't encode
      return false;
    }
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
 * @param {!lm.Codepage} codepage
 * @param {!Set<string>} fileNames
 * @returns {?string}
 */
export function strToTildeName(str, codepage, fileNames) {
  const i = str.lastIndexOf(".");
  const basename = i < 0 ? str : str.substring(0, i);
  const ext = i < 0 ? "" : str.substring(i + 1);

  const basename6 = toValidShortNameCharacters(basename.toUpperCase(), 6, codepage);
  const ext3 = toValidShortNameCharacters(ext.toUpperCase(), 3, codepage);

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
 * @param {!lm.Codepage} codepage
 * @returns {string}
 */
function toValidShortNameCharacters(str, max, codepage) {
  let ret = "";
  let i = 0;
  while (i < str.length && ret.length < max) {
    const ch = str.charAt(i);
    const wcCode = ch.charCodeAt(0);
    const code = codepage.encodeChar(wcCode);
    if (code !== null) {
      if (isShortNameValidCode(code)) {
        const firstSpace = ch === " " && ret === "";
        if (!firstSpace) {
          ret += ch;
        }
      } else {
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
