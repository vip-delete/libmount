"use strict";

/**
 * @fileoverview Public API for LibMount
 * @externs
 */
const LibMount = {};

/**
 * @param {!ArrayBuffer} buf
 * @returns {?LibMount.FileSystem}
 */
LibMount.mount = function (buf) {};

/**
 * @interface
 */
LibMount.File = class {
  /**
   * @returns {string}
   */
  getName() {}

  /**
   * @returns {string}
   */
  getAbsolutePath() {}

  /**
   * @returns {boolean}
   */
  isRegularFile() {}

  /**
   * @returns {boolean}
   */
  isDirectory() {}
};

/**
 * @interface
 */
LibMount.FileSystem = class {
  /**
   * @returns {?LibMount.File}
   */
  getRoot() {}

  /**
   * @param {string} path
   * @returns {?LibMount.File}
   */
  getFile(path) {}

  /**
   * @param {!LibMount.File} file
   * @returns {!Array<!LibMount.File>}
   */
  listFiles(file) {}

  /**
   * @param {!LibMount.File} file
   * @returns {?Uint8Array}
   */
  readFile(file) {}

  /**
   * @param {!LibMount.File} file
   */
  deleteFile(file) {}
};
