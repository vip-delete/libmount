/* eslint-disable jsdoc/check-tag-names */
/* eslint-disable jsdoc/require-returns-check */
/* eslint-disable no-empty-function */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */

/**
 * @file Public API for "libmount"
 * @externs
 */
const lm = {
  /**
   * @param {!ArrayBuffer} buf
   * @param {string} [encoding]
   * @returns {?lm.FileSystem}
   */
  mount(buf, encoding = "cp1251") {},

  /**
   * @interface
   */
  FileSystem: class {
    /**
     * @returns {string}
     */
    getName() {}

    /**
     * @returns {!lm.VolumeInfo}
     */
    getVolumeInfo() {}

    /**
     * @returns {!lm.File}
     */
    getRoot() {}

    /**
     * @param {string} path
     * @returns {?lm.File}
     */
    getFile(path) {}
  },

  /**
   * @interface
   */
  File: class {
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
    length() {}

    /**
     * yyyy.MM.dd HH:mm:ss
     * @returns {!Date}
     */
    lastModified() {}

    /**
     * yyyy.MM.dd HH:mm:ss
     * @returns {!Date}
     */
    creationTime() {}

    /**
     * yyyy.MM.dd
     * @returns {!Date}
     */
    lastAccessTime() {}

    /**
     * @param {function(!lm.File):boolean} predicate
     * @returns {?lm.File}
     */
    findFirst(predicate) {}

    /**
     * @param {function(!lm.File):boolean} predicate
     * @returns {?Array<!lm.File>}
     */
    findAll(predicate) {}

    /**
     * @returns {?Array<!lm.File>}
     */
    listFiles() {}

    /**
     * @returns {?Uint8Array}
     */
    getData() {}

    /**
     * @returns {undefined}
     */
    delete() {}
  },
};

/**
 * @typedef {{
 *            label:string,
 *            serialNumber:number,
 *            clusterSize:number,
 *            totalClusters:number,
 *            freeClusters:number,
 *          }}
 */
lm.VolumeInfo;
