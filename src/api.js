/* eslint-disable jsdoc/require-returns-check */
/* eslint-disable no-unused-vars */

/**
 * @file Public API for LibMount
 * @externs
 */
const LibMount = {
  /**
   * @param {!ArrayBuffer} buf
   * @param {string} [encoding]
   * @returns {?LibMount.FileSystem}
   */
  mount(buf, encoding = "cp1251") {},
};

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
  getShortName() {}

  /**
   * @returns {?string}
   */
  getLongName() {}

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

  /**
   * @returns {number}
   */
  getFileSize() {}

  /**
   * yyyy.MM.dd HH:mm:ss
   * @returns {string}
   */
  getCreatedDate() {}

  /**
   * yyyy.MM.dd HH:mm:ss
   * @returns {string}
   */
  getModifiedDate() {}

  /**
   * yyyy.MM.dd
   * @returns {string}
   */
  getAccessedDate() {}
};

/**
 * @interface
 */
LibMount.FileSystem = class {
  /**
   * @returns {!LibMount.VolumeInfo}
   */
  getVolumeInfo() {}

  /**
   * @returns {!LibMount.File}
   */
  getRoot() {}

  /**
   * @param {string} path
   * @returns {?LibMount.File}
   */
  getFile(path) {}

  /**
   * @param {!LibMount.File} file
   * @returns {?Array<!LibMount.File>}
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

/**
 * @typedef {{
 *            type:string,
 *            label:string,
 *            id:number,
 *            clusterSize:number,
 *            freeSpace:number,
 *          }}
 */
LibMount.VolumeInfo;
