/* eslint-disable no-empty-function */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */

/**
 * @file Public API of "libmount" for Closure Compiler (not used in production)
 * @externs
 */
const lm = {
  /**
   * @param {!Uint8Array} img
   * @param {!lm.Codepage} [codepage]
   * @returns {!lm.Disk}
   */
  mount(img, codepage) {},

  /**
   * Encoding and decoding single-byte character sets (e.g. cp1251, cp1252).
   * @interface
   */
  Codepage: class {
    /**
     * Decodes an array of single-byte characters into a string.
     * @param {!Uint8Array} array
     * @returns {string}
     */
    decode(array) {}

    /**
     * Encodes a string into an array of single-byte characters.
     * @param {string} text
     * @param {number} [defaultCharCode]
     * @returns {!Uint8Array}
     */
    encode(text, defaultCharCode) {}

    /**
     * Convert a wide character code to a single-byte character code if possible.
     * @param {number} wcCode
     * @returns {?number}
     */
    encodeChar(wcCode) {}
  },

  /**
   * @interface
   */
  Disk: class {
    /**
     * @returns {?lm.FileSystem}
     */
    getFileSystem() {}

    /**
     * @returns {!Array<!lm.Partition>}
     */
    getPartitions() {}
  },

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
     * @param {string} absolutePath
     * @returns {?lm.File}
     */
    getFile(absolutePath) {}

    /**
     * @param {string} absolutePath
     * @param {boolean} isDirectory
     * @returns {?lm.File}
     */
    makeFile(absolutePath, isDirectory) {}

    /**
     * @param {string} src
     * @param {string} dest
     * @returns {?lm.File}
     */
    moveFile(src, dest) {}
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

    /**
     * @param {string} relativePath
     * @returns {?lm.File}
     */
    getFile(relativePath) {}

    /**
     * @param {string} relativePath
     * @param {boolean} isDirectory
     * @returns {?lm.File}
     */
    makeFile(relativePath, isDirectory) {}

    /**
     * @param {string} dest
     * @returns {?lm.File}
     */
    moveFile(dest) {}
  },
};

/**
 * @typedef {{
 *            active: boolean,
 *            type: number,
 *            begin: number,
 *            end: number,
 *          }}
 */
lm.Partition;

/**
 * @typedef {{
 *            label: string,
 *            oemName: string,
 *            serialNumber: number,
 *            clusterSize: number,
 *            totalClusters: number,
 *            freeClusters: number,
 *          }}
 */
lm.VolumeInfo;
