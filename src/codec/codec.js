/* eslint-disable no-empty-function */
/* eslint-disable no-unused-vars */

/**
 * @file Public API for "codec"
 * @externs
 */
const codec = {
  /**
   * Encoding and decoding single-byte character sets (e.g. cp1251, cp1252).
   * @interface
   */
  Codec: class {
    /**
     * Decodes an array of single-byte characters into a string.
     * @param {!Uint8Array} array
     * @returns {string}
     */
    decode(array) {}

    /**
     * Encodes a string into an array of single-byte characters.
     * @param {string} text
     * @param {number} [defaultCharCode]
     * @returns {!Uint8Array}
     */
    encode(text, defaultCharCode) {}

    /**
     * Convert a wide character code to a single-byte character code if possible
     * @param {number} wcCode
     * @returns {?number}
     */
    encodeChar(wcCode) {}
  },
};
