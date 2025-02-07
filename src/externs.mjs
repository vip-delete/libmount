/* eslint-disable no-empty-function */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */

/**
 * @file Public API of "libmount" for Closure Compiler
 * @externs
 */
let ns = {
  /**
   * @param {!Uint8Array} img
   * @param {!ns.MountOptions} [options]
   * @return {!ns.Disk}
   */
  mount(img, options) {},

  /**
   * @param {!Array<!ns.Partition>} partitions
   * @return {!ns.DiskSectors}
   */
  fdisk(partitions) {},

  /**
   * @param {number} capacity
   * @param {!ns.VFATOptions} [options]
   * @return {?ns.VFATResult}
   */
  mkfsvfat(capacity, options) {},

  /**
   * The OEM Codepage used to decode and encode FAT short names.
   * @interface
   */
  Codepage: class {
    /**
     * Decodes an array of single-byte characters into a string.
     * @param {!Uint8Array} array
     * @return {string}
     */
    decode(array) {}

    /**
     * Encodes a string into an array of single-byte characters.
     * @param {string} text
     * @return {!Uint8Array}
     */
    encode(text) {}
  },

  /**
   * @interface
   */
  Disk: class {
    /**
     * @return {number}
     */
    capacity() {}

    /**
     * @return {?ns.FileSystem}
     */
    getFileSystem() {}

    /**
     * @return {!Array<!ns.Partition>}
     */
    getPartitions() {}

    /**
     * @param {!ns.DiskSectors} diskSectors
     */
    write(diskSectors) {}
  },

  /**
   * @interface
   */
  FileSystem: class {
    /**
     * @return {string}
     */
    getName() {}

    /**
     * @return {?string}
     */
    getLabel() {}

    /**
     * @param {?string} label
     * @return {undefined}
     */
    setLabel(label) {}

    /**
     * @return {?string}
     */
    getOEMName() {}

    /**
     * @return {number}
     */
    getId() {}

    /**
     * @return {number}
     */
    getSizeOfCluster() {}

    /**
     * @return {number}
     */
    getCountOfClusters() {}

    /**
     * @return {number}
     */
    getFreeClusters() {}

    /**
     * @return {!ns.File}
     */
    getRoot() {}
  },

  /**
   * @interface
   */
  File: class {
    /**
     * @return {string}
     */
    getName() {}

    /**
     * @return {string}
     */
    getShortName() {}

    /**
     * @return {string}
     */
    getAbsolutePath() {}

    /**
     * @return {boolean}
     */
    isRegularFile() {}

    /**
     * @return {boolean}
     */
    isDirectory() {}

    /**
     * @return {number}
     */
    length() {}

    /**
     * @return {number}
     */
    getSizeOnDisk() {}

    /**
     * yyyy.MM.dd HH:mm:ss
     * @return {?Date}
     */
    getLastModified() {}

    /**
     * yyyy.MM.dd HH:mm:ss
     * @param {?Date} date
     */
    setLastModified(date) {}

    /**
     * yyyy.MM.dd HH:mm:ss
     * @return {?Date}
     */
    getCreationTime() {}

    /**
     * yyyy.MM.dd HH:mm:ss
     * @param {?Date} date
     */
    setCreationTime(date) {}

    /**
     * yyyy.MM.dd
     * @return {?Date}
     */
    getLastAccessTime() {}

    /**
     * yyyy.MM.dd
     * @param {?Date} date
     */
    setLastAccessTime(date) {}

    /**
     * @param {function(!ns.File):boolean} predicate
     * @return {?ns.File}
     */
    findFirst(predicate) {}

    /**
     * @param {function(!ns.File):boolean} predicate
     * @return {?Array<!ns.File>}
     */
    findAll(predicate) {}

    /**
     * @return {?Array<!ns.File>}
     */
    listFiles() {}

    /**
     * @return {?ns.FileIO}
     */
    open() {}

    /**
     * @return {undefined}
     */
    delete() {}

    /**
     * @param {string} relativePath
     * @return {?ns.File}
     */
    getFile(relativePath) {}

    /**
     * @param {string} relativePath
     * @return {?ns.File}
     */
    makeFile(relativePath) {}

    /**
     * @param {string} relativePath
     * @return {?ns.File}
     */
    makeDir(relativePath) {}

    /**
     * @param {string} dest
     * @return {?ns.File}
     */
    moveTo(dest) {}
  },

  /**
   * @interface
   */
  FileIO: class {
    /**
     *
     */
    rewind() {}

    /**
     * @return {number}
     */
    skipClus() {}

    /**
     * @param {!Uint8Array} buf
     * @return {number}
     */
    readClus(buf) {}

    /**
     * @param {!Uint8Array} buf
     * @return {number}
     */
    writeClus(buf) {}

    /**
     * @return {!Uint8Array}
     */
    readData() {}

    /**
     * @param {!Uint8Array} data
     * @return {number}
     */
    writeData(data) {}
  },
};

/**
 * @typedef {{
 *            codepage: ns.Codepage,
 *            partition: ns.Partition,
 *          }}
 */
ns.MountOptions;

/**
 * @typedef {{
 *            id: number,
 *            bs: Uint8Array,
 *            message: Uint8Array,
 *            type: string,
 *            numFATs: number,
 *            rootEntCnt: number,
 *            secPerClus: number,
 *            label: Uint8Array,
 *            compat: number,
 *            oemName: Uint8Array,
 *            media: number,
 *            secPerTrk: number,
 *            numHeads: number,
 *            hiddSec: number,
 *          }}
 */
ns.VFATOptions;

/**
 * @typedef {{
 *            sectors: ns.DiskSectors,
 *            id: number,
 *            type: string,
 *            totSec: number,
 *            rsvdSecCnt: number,
 *            numFATs: number,
 *            fatSz: number,
 *            rootDirSectors: number,
 *            countOfClusters: number,
 *            secPerClus: number,
 *            bytsPerSec: number,
 *          }}
 */
ns.VFATResult;

/**
 * @typedef {{
 *            bytsPerSec: number,
 *            zeroRegions: !Array<!ns.ZeroRegion>,
 *            dataSectors: !Array<!ns.DataSector>,
 *          }}
 */
ns.DiskSectors;

/**
 * @typedef {{
 *            i: number,
 *            count: number,
 *          }}
 */
ns.ZeroRegion;

/**
 * @typedef {{
 *            i: number,
 *            data: !Uint8Array,
 *          }}
 */
ns.DataSector;

/**
 * @typedef {{
 *            active: boolean,
 *            type: number,
 *            relativeSectors: number,
 *            totalSectors: number,
 *          }}
 */
ns.Partition;
