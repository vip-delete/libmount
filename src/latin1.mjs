/**
 * @implements {ns.Codepage}
 */
class Latin1 {
  /**
   * @override
   * @param {!Uint8Array} array
   * @return {string}
   */
  // @ts-expect-error
  // eslint-disable-next-line class-methods-use-this
  decode(array) {
    return new TextDecoder("UTF-16").decode(new Uint16Array(array));
  }

  /**
   * @override
   * @param {string} text
   * @return {!Uint8Array}
   */
  // @ts-expect-error
  // eslint-disable-next-line class-methods-use-this
  encode(text) {
    const len = text.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const code = text.charCodeAt(i);
      bytes[i] = code < 256 ? code : "?".charCodeAt(0);
    }
    return bytes;
  }
}

// Export

export const latin1 = new Latin1();
