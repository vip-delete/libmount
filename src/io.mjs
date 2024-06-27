import { Device } from "./types.mjs";
import { assert } from "./support.mjs";

/**
 * @implements {Device}
 */
export class RawDevice {
  /**
   * @param {!Uint8Array} img
   */
  constructor(img) {
    this.img = img;
    this.pos = 0;
  }

  /**
   * @override
   * @returns {number}
   */
  length() {
    return this.img.length;
  }

  /**
   * @override
   * @param {number} offset
   */
  seek(offset) {
    this.pos = offset;
  }

  /**
   * @override
   * @param {number} bytes
   */
  skip(bytes) {
    this.pos += bytes;
  }

  /**
   * @override
   * @param {number} len
   * @returns {!Uint8Array}
   */
  readArray(len) {
    assert(this.pos + len <= this.length());
    const r = this.img.subarray(this.pos, this.pos + len);
    this.pos += len;
    return r;
  }

  /**
   * @override
   * @returns {number}
   */
  readByte() {
    assert(this.pos + 1 <= this.length());
    return this.img[this.pos++];
  }

  /**
   * @override
   * @returns {number}
   */
  readWord() {
    assert(this.pos + 2 <= this.length());
    return this.img[this.pos++] | (this.img[this.pos++] << 8);
  }

  /**
   * @override
   * @returns {number}
   */
  readDoubleWord() {
    assert(this.pos + 4 <= this.length());
    return (this.img[this.pos++] | (this.img[this.pos++] << 8) | (this.img[this.pos++] << 16) | (this.img[this.pos++] << 24)) >>> 0;
  }

  /**
   * @override
   * @param {!Uint8Array} array
   */
  writeArray(array) {
    assert(this.pos + array.length <= this.length());
    this.img.set(array, this.pos);
    this.pos += array.length;
  }

  /**
   * @override
   * @param {number} val
   */
  writeByte(val) {
    assert(this.pos + 1 <= this.length());
    assert(val >= 0 && val <= 0xff);
    this.img[this.pos++] = val;
  }

  /**
   * @override
   * @param {number} val
   */
  writeWord(val) {
    assert(this.pos + 2 <= this.length());
    assert(val >= 0 && val <= 0xffff);
    this.img[this.pos++] = val & 0xff;
    this.img[this.pos++] = val >>> 8;
  }

  /**
   * @override
   * @param {number} val
   */
  writeDoubleWord(val) {
    assert(this.pos + 4 <= this.length());
    assert(val >= 0 && val <= 0xffffffff);
    this.img[this.pos++] = val & 0xff;
    this.img[this.pos++] = (val >>> 8) & 0xff;
    this.img[this.pos++] = (val >>> 16) & 0xff;
    this.img[this.pos++] = val >>> 24;
  }
}
