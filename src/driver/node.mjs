import { DirEntry } from "../types.mjs";

/**
 * @enum
 */
export const FATNodeKind = {
  ROOT: 0,
  REGULAR_DIR: 1,
  REGULAR_FILE: 2,
  VOLUME_ID: 3,
  DOT_DIR: 4,
  DOTDOT_DIR: 5,
  INVALID: 6,
  DELETED: 7,
  DELETED_LFN: 8,
  LAST: 9,
};

export class FATNode {
  /**
   * @param {!FATNodeKind} kind
   * @param {string} longName
   * @param {string} shortName
   * @param {number} firstDirOffset
   * @param {number} dirCount
   * @param {!DirEntry} dir
   */
  constructor(kind, longName, shortName, firstDirOffset, dirCount, dir) {
    /** @private  */ this.kind = kind;
    /** @constant */ this.longName = longName;
    /** @constant */ this.shortName = shortName;
    /** @constant */ this.firstDirOffset = firstDirOffset;
    /** @constant */ this.dirCount = dirCount;
    /** @constant */ this.dir = dir;
  }

  /**
   * @returns {boolean}
   */
  isRoot() {
    return this.kind === FATNodeKind.ROOT;
  }

  /**
   * @returns {boolean}
   */
  isRegularDir() {
    return this.kind === FATNodeKind.REGULAR_DIR;
  }

  /**
   * @returns {boolean}
   */
  isRegularFile() {
    return this.kind === FATNodeKind.REGULAR_FILE;
  }

  /**
   * @returns {boolean}
   */
  isVolumeId() {
    return this.kind === FATNodeKind.VOLUME_ID;
  }

  /**
   * @returns {boolean}
   */
  isDot() {
    return this.kind === FATNodeKind.DOT_DIR;
  }

  /**
   * @returns {boolean}
   */
  isDotDot() {
    return this.kind === FATNodeKind.DOTDOT_DIR;
  }

  /**
   * @returns {boolean}
   */
  isInvalid() {
    return this.kind === FATNodeKind.INVALID;
  }

  /**
   * @returns {boolean}
   */
  isLast() {
    return this.kind === FATNodeKind.LAST;
  }

  /**
   * @returns {boolean}
   */
  isDeleted() {
    return this.kind === FATNodeKind.DELETED;
  }

  /**
   * @returns {boolean}
   */
  isDeletedLFN() {
    return this.kind === FATNodeKind.DELETED_LFN;
  }

  /**
   * @returns {undefined}
   */
  markDeleted() {
    this.kind = FATNodeKind.DELETED;
  }
}
