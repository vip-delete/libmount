/**
 * @implements {lmNS.Encoding}
 */
class Latin1 {
  /**
   * @override
   * @param {!Uint8Array} array
   * @returns {string}
   */
  // @ts-ignore
  decode(array) {
    return new TextDecoder("UTF-16").decode(new Uint16Array(array));
  }

  /**
   * @override
   * @param {string} text
   * @returns {!Uint8Array}
   */
  // @ts-ignore
  encode(text) {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 256) {
        bytes[i] = code;
      } else {
        bytes[i] = "?".charCodeAt(0);
      }
    }
    return bytes;
  }
}

export const LATIN1 = new Latin1();
