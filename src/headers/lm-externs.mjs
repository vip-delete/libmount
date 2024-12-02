/* eslint-disable no-empty-function */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */

/**
 * @file Public API of "libmount" for Closure Compiler (not used in production)
 * @externs
 */
const lmNS = {
  /**
   * @param {!Uint8Array} img
   * @param {!lmNS.MountOptions} [options]
   * @returns {!lmNS.Disk}
   */
  mount(img, options) {},

  /**
   * Encoding and decoding single-byte character sets (e.g. cp1251, cp1252).
   * @interface
   */
  Encoding: class {
    /**
     * Decodes an array of single-byte characters into a string.
     * @param {!Uint8Array} array
     * @returns {string}
     */
    decode(array) {}

    /**
     * Encodes a string into an array of single-byte characters.
     * @param {string} text
     * @returns {!Uint8Array}
     */
    encode(text) {}
  },

  /**
   * @interface
   */
  Disk: class {
    /**
     * @returns {?lmNS.FileSystem}
     */
    getFileSystem() {}

    /**
     * @returns {!Array<!lmNS.Partition>}
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
     * @returns {!lmNS.Volume}
     */
    getVolume() {}

    /**
     * @returns {!lmNS.File}
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
     * @param {function(!lmNS.File):boolean} predicate
     * @returns {?lmNS.File}
     */
    findFirst(predicate) {}

    /**
     * @param {function(!lmNS.File):boolean} predicate
     * @returns {?Array<!lmNS.File>}
     */
    findAll(predicate) {}

    /**
     * @returns {?Array<!lmNS.File>}
     */
    listFiles() {}

    /**
     * @returns {?Uint8Array}
     */
    getData() {}

    /**
     * @param {!Uint8Array} data
     * @returns {?lmNS.File}
     */
    setData(data) {}

    /**
     * @returns {undefined}
     */
    delete() {}

    /**
     * @param {string} relativePath
     * @returns {?lmNS.File}
     */
    getFile(relativePath) {}

    /**
     * @param {string} relativePath
     * @returns {?lmNS.File}
     */
    makeFile(relativePath) {}

    /**
     * @param {string} relativePath
     * @returns {?lmNS.File}
     */
    makeDir(relativePath) {}

    /**
     * @param {string} dest
     * @returns {?lmNS.File}
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
 *            encoding: lmNS.Encoding,
 *            partition: lmNS.Partition,
 *          }}
 */
lmNS.MountOptions;

/**
 * @typedef {{
 *            active: boolean,
 *            type: number,
 *            begin: number,
 *            end: number,
 *          }}
 */
lmNS.Partition;
