/* eslint-disable jsdoc/check-types */

/**
 * @implements {codec.Codec}
 */
export class StandardCodec {
  /**
   * @param {!Array<number>} charmap
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
    let text = "";
    for (let i = 0; i < array.length; i++) {
      const wcCode = this.charmap[array[i]];
      text += String.fromCharCode(wcCode);
    }
    return text;
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
 * @param {!Array<number>} charmap
 * @returns {!Object<number, number>}
 */
function createWcTable(charmap) {
  const wcTable = {};
  charmap.forEach((it, i) => {
    wcTable[it] = i;
  });
  return wcTable;
}
