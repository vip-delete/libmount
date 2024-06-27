import { Device } from "./types.mjs";
import { assert } from "./support.mjs";

/**
 * @implements {Device}
 */
export class DataViewDevice {
  /**
   * @param {!Uint8Array} img
   */
  constructor(img) {
    this.dataView = new DataView(img.buffer, img.byteOffset, img.length);
    this.pos = 0;
  }

  /**
   * @override
   * @returns {number}
   */
  length() {
    return this.dataView.byteLength;
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
    const r = new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + this.pos, len);
    this.pos += len;
    return r;
  }

  /**
   * @override
   * @returns {number}
   */
  readByte() {
    assert(this.pos + 1 <= this.length());
    const r = this.dataView.getUint8(this.pos);
    this.pos += 1;
    return r;
  }

  /**
   * @override
   * @returns {number}
   */
  readWord() {
    assert(this.pos + 2 <= this.length());
    const r = this.dataView.getUint16(this.pos, true);
    this.pos += 2;
    return r;
  }

  /**
   * @override
   * @returns {number}
   */
  readDoubleWord() {
    assert(this.pos + 4 <= this.length());
    const r = this.dataView.getUint32(this.pos, true);
    this.pos += 4;
    return r;
  }

  /**
   * @override
   * @param {number} val
   */
  writeByte(val) {
    assert(this.pos + 1 <= this.length());
    assert(val >= 0 && val <= 0xff);
    this.dataView.setUint8(this.pos, val);
    this.pos += 1;
  }

  /**
   * @override
   * @param {number} val
   */
  writeWord(val) {
    assert(this.pos + 2 <= this.length());
    assert(val >= 0 && val <= 0xffff);
    this.dataView.setUint16(this.pos, val, true);
    this.pos += 2;
  }

  /**
   * @override
   * @param {number} val
   */
  writeDoubleWord(val) {
    assert(this.pos + 4 <= this.length());
    assert(val >= 0 && val <= 0xffffffff);
    this.dataView.setUint32(this.pos, val, true);
    this.pos += 4;
  }
}
