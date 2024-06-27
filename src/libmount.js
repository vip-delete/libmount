/* eslint-disable no-empty-function */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */

/**
 * @file Public API for "libmount"
 * @externs
 */
const lm = {
  /**
   * @param {!Uint8Array} img
   * @param {!codec.Codec} [codec]
   * @returns {!lm.Disk}
   */
  mount(img, codec) {},

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
     * @returns {?lm.File}
     */
    mkdir(absolutePath) {}

    /**
     * @param {string} absolutePath
     * @returns {?lm.File}
     */
    mkfile(absolutePath) {}
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
     * @returns {?lm.File}
     */
    mkdir(relativePath) {}

    /**
     * @param {string} relativePath
     * @returns {?lm.File}
     */
    mkfile(relativePath) {}
  },

  /**
   * @interface
   */
  Codec: class {
    /**
     * @param {!Uint8Array} array
     * @returns {string}
     */
    decode(array) {}

    /**
     * @param {string} text
     * @returns {!Uint8Array}
     */
    encode(text) {}
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
