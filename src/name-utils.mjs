import { assert } from "./support.mjs";

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
 * @param {!Uint8Array} sfn
 * @param {!codec.Codec} decoder
 * @returns {string}
 */
export function sfnToStr(sfn, decoder) {
  assert(sfn.length === 11);
  const basename = decoder.decode(sfn.subarray(0, 8)).trimEnd();
  const ext = decoder.decode(sfn.subarray(8, 11)).trimEnd();
  return ext === "" ? basename : basename + "." + ext;
}

/**
 * @param {string} str
 * @param {!codec.Codec} encoder
 * @returns {?Uint8Array}
 */
export function strToSfn(str, encoder) {
  const i = str.lastIndexOf(".");
  const basename = i < 0 ? str : str.substring(0, i);
  const ext = i < 0 ? "" : str.substring(i + 1);
  if (basename === "" && ext === "") {
    // both are empty
    return null;
  }
  const sfn = new Uint8Array(11);
  if (!appendToSFN(sfn, 0, 8, encoder, basename)) {
    // filename is not valid for short name
    return null;
  }
  if (!appendToSFN(sfn, 8, 3, encoder, ext)) {
    // ext is not valid for short name
    return null;
  }
  return sfn;
}

/**
 * @param {!Uint8Array} sfn
 * @param {number} offset
 * @param {number} len
 * @param {!codec.Codec} encoder
 * @param {string} str
 * @returns {boolean}
 */
function appendToSFN(sfn, offset, len, encoder, str) {
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
    const code = encoder.encodeChar(wcCode);
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
 * @param {!codec.Codec} encoder
 * @param {!Set<string>} fileNames
 * @returns {?string}
 */
export function strToTildeName(str, encoder, fileNames) {
  const i = str.lastIndexOf(".");
  const basename = i < 0 ? str : str.substring(0, i);
  const ext = i < 0 ? "" : str.substring(i + 1);

  const basename6 = toValidShortNameCharacters(basename.toUpperCase(), 6, encoder);
  const ext3 = toValidShortNameCharacters(ext.toUpperCase(), 3, encoder);

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
  // namespace overflow (very unlikely)
  return null;
}

/**
 * @param {string} str
 * @param {number} max
 * @param {!codec.Codec} encoder
 * @returns {string}
 */
function toValidShortNameCharacters(str, max, encoder) {
  let ret = "";
  let i = 0;
  while (i < str.length && ret.length < max) {
    const ch = str.charAt(i);
    const wcCode = ch.charCodeAt(0);
    const code = encoder.encodeChar(wcCode);
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
    sum = (sum + str.charCodeAt(i)) & 0xFFFF;
  }
  return sum.toString(16).padStart(4, "0").toUpperCase();
}
