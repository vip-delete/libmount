declare module "libmount/codecs" {
  /**
   * Encoding and decoding single-byte character sets (e.g. cp1251, cp1252).
   */
  export interface Codec {
    /**
     * Decodes an array of single-byte characters into a string.
     * @param {!Uint8Array} array
     * @returns {string}
     */
    decode(array: Uint8Array): string;

    /**
     * Encodes a string into an array of single-byte characters.
     * @param {string} text
     * @param {number} [defaultCharCode]
     * @returns {!Uint8Array}
     */
    encode(text: string, defaultCharCode?: number): Uint8Array;
  }
}
