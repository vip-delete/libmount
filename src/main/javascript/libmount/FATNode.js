"use strict";

/**
 * @enum
 */
const FAT_NODE = {
  ROOT: 0,
  VOLUME_ID: 1,
  DELETED: 2,
  CURRENT_DIR: 3,
  PARENT_DIR: 4,
  REGULAR_FILE: 5,
  REGULAR_DIR: 6,
};

class FATNode {
  /**
   * @param {number} type
   * @param {string} shortName
   * @param {?string} longName
   * @param {number} fileSize
   * @param {number} offset
   * @param {number} length
   * @param {number} contentOffset
   */
  constructor(type, shortName, longName, fileSize, offset, length, contentOffset) {
    /** @type {number}  */ this.type = type;
    /** @type {string}  */ this.shortName = shortName;
    /** @type {?string} */ this.longName = longName;
    /** @type {number}  */ this.fileSize = fileSize;
    /** @type {number}  */ this.offset = offset;
    /** @type {number}  */ this.length = length;
    /** @type {number}  */ this.contentOffset = contentOffset;
  }

  /**
   * @returns {string}
   */
  getName() {
    return this.longName != null ? this.longName : this.shortName;
  }

  /**
   * @returns {boolean}
   */
  isRegular() {
    return this.type === FAT_NODE.REGULAR_FILE || this.type === FAT_NODE.REGULAR_DIR || this.type === FAT_NODE.ROOT;
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  isMatch(name) {
    const upperCaseName = name.toUpperCase();
    return upperCaseName === this.shortName || (this.longName != null && this.longName.toUpperCase() === upperCaseName);
  }
}
