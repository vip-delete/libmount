/* eslint-disable jsdoc/check-types */

/**
 * @implements {lm.Codepage}
 */
export class OEMCodepage {
  /**
   * @param {!Uint16Array} charmap
   * @param {!Object<number, number>} [wcTable]
   */
  constructor(charmap, wcTable) {
    this.charmap = charmap;
    this.wcTable = wcTable ?? createWcTable(charmap);
  }

  /**
   * @override
   * @param {!Uint8Array} array
   * @returns {string}
   */
  decode(array) {
    const charmap = this.charmap;
    const len = array.length;
    const charCodes = new Uint16Array(len);
    for (let i = 0; i < len; i++) {
      charCodes[i] = charmap[array[i]];
    }
    return String.fromCharCode.apply(null, charCodes);
  }

  /**
   * @override
   * @param {string} text
   * @param {number} [defaultCharCode]
   * @returns {!Uint8Array}
   */
  encode(text, defaultCharCode) {
    const array = new Uint8Array(text.length);
    for (let i = 0; i < array.length; i++) {
      const wcCode = text.charCodeAt(i);
      const code = this.encodeChar(wcCode);
      if (code === null) {
        array[i] = defaultCharCode ?? "_".charCodeAt(0);
      } else {
        array[i] = code;
      }
    }
    return array;
  }

  /**
   * @override
   * @param {number} wcCode
   * @returns {?number}
   */
  encodeChar(wcCode) {
    return this.wcTable[wcCode] ?? null;
  }
}

/**
 * @nosideeffects
 * @param {!Uint16Array} charmap
 * @returns {!Object<number, number>}
 */
function createWcTable(charmap) {
  const wcTable = {};
  for (let i = 0; i < charmap.length; i++) {
    wcTable[charmap[i]] = i;
  }
  return wcTable;
}
