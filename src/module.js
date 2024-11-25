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
   * @param {!lm.MountOptions} [options]
   * @returns {!lm.Disk}
   */
  mount(img, options) {},

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
     * @returns {!lm.Volume}
     */
    getVolume() {}

    /**
     * @returns {!lm.File}
     */
    getRoot() {}
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
     * @returns {number}
     */
    getSizeOnDisk() {}

    /**
     * yyyy.MM.dd HH:mm:ss
     * @returns {?Date}
     */
    lastModified() {}

    /**
     * yyyy.MM.dd HH:mm:ss
     * @returns {?Date}
     */
    creationTime() {}

    /**
     * yyyy.MM.dd
     * @returns {?Date}
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
     * @param {!Uint8Array} data
     * @returns {?lm.File}
     */
    setData(data) {}

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
     * @returns {?lm.File}
     */
    makeFile(relativePath) {}

    /**
     * @param {string} relativePath
     * @returns {?lm.File}
     */
    makeDir(relativePath) {}

    /**
     * @param {string} dest
     * @returns {?lm.File}
     */
    moveTo(dest) {}
  },

  /**
   * @interface
   */
  Volume: class {
    /**
     * @returns {?string}
     */
    getLabel() {}

    /**
     * @param {?string} label
     * @returns {undefined}
     */
    setLabel(label) {}

    /**
     * @returns {?string}
     */
    getOEMName() {}

    /**
     * @param {?string} oemName
     * @returns {undefined}
     */
    setOEMName(oemName) {}

    /**
     * @returns {number}
     */
    getId() {}

    /**
     * @param {number} id
     * @returns {undefined}
     */
    setId(id) {}

    /**
     * @returns {number}
     */
    getSizeOfCluster() {}

    /**
     * @returns {number}
     */
    getCountOfClusters() {}

    /**
     * @returns {number}
     */
    getFreeClusters() {}
  },
};

/**
 * @typedef {{
 *            codepage: lm.Codepage,
 *            partition: lm.Partition,
 *          }}
 */
lm.MountOptions;

/**
 * @typedef {{
 *            active: boolean,
 *            type: number,
 *            begin: number,
 *            end: number,
 *          }}
 */
lm.Partition;
