"use strict";

class BlockDevice {
  /**
   * @param {!ArrayBuffer} buf
   */
  constructor(buf) {
    this.dataView = new DataView(buf);
    this.pos = 0;
  }

  /**
   * @param {number} len
   * @returns {!Uint8Array}
   */
  readArray(len) {
    const r = new Uint8Array(this.dataView.buffer, this.pos, len);
    this.pos += len;
    return r;
  }

  /**
   * @returns {number}
   */
  readByte() {
    const r = this.dataView.getUint8(this.pos);
    this.pos += 1;
    return r;
  }

  /**
   * @returns {number}
   */
  readWord() {
    const r = this.dataView.getUint16(this.pos, true);
    this.pos += 2;
    return r;
  }

  /**
   * @returns {number}
   */
  readDoubleWord() {
    const r = this.dataView.getUint32(this.pos, true);
    this.pos += 4;
    return r;
  }
}