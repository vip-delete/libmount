import { MAX_BYTE, MAX_DOUBLE_WORD, MAX_WORD } from "./const.mjs";
import { IO } from "./types.mjs";
import { assert } from "./utils.mjs";

/**
 * @implements {IO}
 */
class SyncIO {
  /**
   * @param {!Uint8Array} img
   */
  constructor(img) {
    /**
     * @private
     * @constant
     */
    this.img = img;
    /**
     * @private
     */
    this.i = 0;
  }

  // IO

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  pos() {
    return this.i;
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  len() {
    return this.img.length;
  }

  /**
   * @override
   * @param {number} offset
   * @return {!IO}
   */
  // @ts-expect-error
  seek(offset) {
    this.i = offset;
    return this;
  }

  /**
   * @override
   * @param {number} bytes
   * @return {!IO}
   */
  // @ts-expect-error
  skip(bytes) {
    this.i += bytes;
    return this;
  }

  /**
   * @override
   * @param {number} len
   * @return {!Uint8Array}
   */
  // @ts-expect-error
  peekUint8Array(len) {
    assert(this.i + len <= this.img.length);
    return this.img.subarray(this.i, this.i + len);
  }

  /**
   * @override
   * @param {number} len
   * @return {!Uint8Array}
   */
  // @ts-expect-error
  readUint8Array(len) {
    assert(this.i + len <= this.img.length);
    const k = new Uint8Array(this.img.subarray(this.i, (this.i += len)));
    return k;
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  readByte() {
    assert(this.i < this.img.length);
    return this.img[this.i++];
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  readWord() {
    const { img } = this;
    assert(this.i + 2 <= img.length);
    const k = img[this.i++] | (img[this.i++] << 8);
    return k;
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  readDoubleWord() {
    const { img } = this;
    assert(this.i + 4 <= img.length);
    const k = (img[this.i++] | (img[this.i++] << 8) | (img[this.i++] << 16) | (img[this.i++] << 24)) >>> 0;
    return k;
  }

  /**
   * @override
   * @param {!Uint8Array} array
   * @return {!IO}
   */
  // @ts-expect-error
  writeUint8Array(array) {
    assert(this.i + array.length <= this.img.length);
    this.img.set(array, this.i);
    this.i += array.length;
    return this;
  }

  /**
   * @override
   * @param {number} data
   * @return {!IO}
   */
  // @ts-expect-error
  writeByte(data) {
    assert(this.i + 1 <= this.img.length);
    assert(data >= 0 && data <= MAX_BYTE);
    this.img[this.i++] = data; // & 0xff;
    return this;
  }

  /**
   * @override
   * @param {number} data
   * @param {number} count
   * @return {!IO}
   */
  // @ts-expect-error
  writeBytes(data, count) {
    assert(count >= 0);
    assert(this.i + count <= this.img.length);
    assert(data >= 0 && data <= MAX_BYTE);
    this.img.fill(data, this.i, (this.i += count));
    return this;
  }

  /**
   * @override
   * @param {number} data
   * @return {!IO}
   */
  // @ts-expect-error
  writeWord(data) {
    const { img } = this;
    assert(this.i + 2 <= img.length);
    assert(data >= 0 && data <= MAX_WORD);
    img[this.i++] = data; // & 0xff;
    data >>>= 8;
    img[this.i++] = data; // & 0xff;
    return this;
  }

  /**
   * @override
   * @param {number} data
   * @return {!IO}
   */
  // @ts-expect-error
  writeDoubleWord(data) {
    const { img } = this;
    assert(this.i + 4 <= img.length);
    assert(data >= 0 && data <= MAX_DOUBLE_WORD);
    img[this.i++] = data; // & 0xff;
    data >>>= 8;
    img[this.i++] = data; // & 0xff;
    data >>>= 8;
    img[this.i++] = data; // & 0xff;
    data >>>= 8;
    img[this.i++] = data; // & 0xff;
    return this;
  }
}

// Export

/**
 * @param {!Uint8Array} img
 * @return {!IO}
 */
export const createIO = (img) => new SyncIO(img);
