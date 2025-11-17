import { MAX_BYTE, MAX_DOUBLE_WORD, MAX_WORD } from "./const.mjs";
import { Driver, IO } from "./types.mjs";
import { assert } from "./utils.mjs";

/**
 * @implements {Driver}
 */
class DriverIO {
  /**
   * @param {!ns.RandomAccessDriver} driver
   */
  constructor(driver) {
    /**
     * @private
     * @constant
     */
    this.driver = driver;
  }

  // Driver

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  len() {
    return this.driver.capacity;
  }

  /**
   * @override
   * @param {number} address
   * @param {number} len
   * @return {!Uint8Array}
   */
  // @ts-expect-error
  readUint8Array(address, len) {
    assert(address + len <= this.driver.capacity);
    return this.driver.read(address, len);
  }

  /**
   * @override
   * @param {number} address
   * @return {number}
   */
  // @ts-expect-error
  readByte(address) {
    return this.readUint8Array(address, 1)[0];
  }

  /**
   * @override
   * @param {number} address
   * @return {number}
   */
  // @ts-expect-error
  readWord(address) {
    const array = this.readUint8Array(address, 2);
    const k = array[0] | (array[1] << 8);
    return k;
  }

  /**
   * @override
   * @param {number} address
   * @return {number}
   */
  // @ts-expect-error
  readDoubleWord(address) {
    const array = this.readUint8Array(address, 4);
    const k = (array[0] | (array[1] << 8) | (array[2] << 16) | (array[3] << 24)) >>> 0;
    return k;
  }

  /**
   * @override
   * @param {number} address
   * @param {!Uint8Array} array
   */
  // @ts-expect-error
  writeUint8Array(address, array) {
    assert(address + array.length <= this.driver.capacity);
    this.driver.write?.(address, array);
  }

  /**
   * @override
   * @param {number} address
   * @param {number} data
   */
  // @ts-expect-error
  writeByte(address, data) {
    this.writeUint8Array(address, new Uint8Array([data]));
  }

  /**
   * @override
   * @param {number} address
   * @param {number} data
   * @param {number} count
   */
  // @ts-expect-error
  writeBytes(address, data, count) {
    this.writeUint8Array(address, new Uint8Array(count).fill(data));
  }

  /**
   * @override
   * @param {number} address
   * @param {number} data
   */
  // @ts-expect-error
  writeWord(address, data) {
    this.writeUint8Array(address, new Uint8Array([data, data >>> 8]));
  }

  /**
   * @override
   * @param {number} address
   * @param {number} data
   */
  // @ts-expect-error
  writeDoubleWord(address, data) {
    this.writeUint8Array(address, new Uint8Array([data, data >>> 8, data >>> 16, data >>> 24]));
  }
}

/**
 * @implements {IO}
 */
class SyncIO {
  /**
   * @param {!Uint8Array} array
   */
  constructor(array) {
    /**
     * @private
     * @constant
     */
    this.array = array;
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
    return this.array.length;
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
  readUint8Array(len) {
    assert(this.i + len <= this.array.length);
    const k = new Uint8Array(this.array.subarray(this.i, (this.i += len)));
    return k;
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  readByte() {
    assert(this.i < this.array.length);
    return this.array[this.i++];
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  readWord() {
    const { array } = this;
    assert(this.i + 2 <= array.length);
    const k = array[this.i++] | (array[this.i++] << 8);
    return k;
  }

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  readDoubleWord() {
    const { array } = this;
    assert(this.i + 4 <= array.length);
    const k = (array[this.i++] | (array[this.i++] << 8) | (array[this.i++] << 16) | (array[this.i++] << 24)) >>> 0;
    return k;
  }

  /**
   * @override
   * @param {!Uint8Array} array
   * @return {!IO}
   */
  // @ts-expect-error
  writeUint8Array(array) {
    assert(this.i + array.length <= this.array.length);
    this.array.set(array, this.i);
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
    assert(this.i + 1 <= this.array.length);
    assert(data >= 0 && data <= MAX_BYTE);
    this.array[this.i++] = data; // & 0xff;
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
    assert(this.i + count <= this.array.length);
    assert(data >= 0 && data <= MAX_BYTE);
    this.array.fill(data, this.i, (this.i += count));
    return this;
  }

  /**
   * @override
   * @param {number} data
   * @return {!IO}
   */
  // @ts-expect-error
  writeWord(data) {
    const { array } = this;
    assert(this.i + 2 <= array.length);
    assert(data >= 0 && data <= MAX_WORD);
    array[this.i++] = data; // & 0xff;
    data >>>= 8;
    array[this.i++] = data; // & 0xff;
    return this;
  }

  /**
   * @override
   * @param {number} data
   * @return {!IO}
   */
  // @ts-expect-error
  writeDoubleWord(data) {
    const { array } = this;
    assert(this.i + 4 <= array.length);
    assert(data >= 0 && data <= MAX_DOUBLE_WORD);
    array[this.i++] = data; // & 0xff;
    data >>>= 8;
    array[this.i++] = data; // & 0xff;
    data >>>= 8;
    array[this.i++] = data; // & 0xff;
    data >>>= 8;
    array[this.i++] = data; // & 0xff;
    return this;
  }
}

// Export

/**
 * @param {!ns.RandomAccessDriver} driver
 * @return {!Driver}
 */
export const createDriver = (driver) => new DriverIO(driver);

/**
 * @param {!Uint8Array} array
 * @return {!IO}
 */
export const createIO = (array) => new SyncIO(array);
