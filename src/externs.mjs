/* eslint-disable no-empty-function */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unused-vars */
/* eslint-disable class-methods-use-this */
/* eslint-disable jsdoc/require-returns-check */

/**
 * @file Public API of "libmount" for Closure Compiler
 * @externs
 */
const libmount = {
  /**
   * @param {!libmount.RandomAccessDriver|!Uint8Array} driver
   * @param {!libmount.MountOptions} [options]
   * @return {!libmount.Disk}
   */
  mount(driver, options) {},

  /**
   * @param {!Array<!libmount.Partition>} partitions
   * @return {!libmount.DiskSectors}
   */
  fdisk(partitions) {},

  /**
   * @param {number} capacity
   * @param {!libmount.VFATOptions} [options]
   * @return {?libmount.VFATResult}
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
     * @return {?libmount.FileSystem}
     */
    getFileSystem() {}

    /**
     * @return {!Array<!libmount.Partition>}
     */
    getPartitions() {}

    /**
     * @param {!libmount.DiskSectors} diskSectors
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
     * @return {void}
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
     * @return {!libmount.File}
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
     * @param {function(!libmount.File):boolean} predicate
     * @return {?libmount.File}
     */
    findFirst(predicate) {}

    /**
     * @param {function(!libmount.File):boolean} predicate
     * @return {?Array<!libmount.File>}
     */
    findAll(predicate) {}

    /**
     * @return {?Array<!libmount.File>}
     */
    listFiles() {}

    /**
     * @return {?libmount.FileIO}
     */
    open() {}

    /**
     * @return {void}
     */
    delete() {}

    /**
     * @param {string} relativePath
     * @return {?libmount.File}
     */
    getFile(relativePath) {}

    /**
     * @param {string} relativePath
     * @return {?libmount.File}
     */
    makeFile(relativePath) {}

    /**
     * @param {string} relativePath
     * @return {?libmount.File}
     */
    makeDir(relativePath) {}

    /**
     * @param {string} dest
     * @return {?libmount.File}
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
 *            codepage: libmount.Codepage,
 *            partition: libmount.Partition,
 *          }}
 */
libmount.MountOptions;

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
libmount.VFATOptions;

/**
 * @typedef {{
 *            sectors: libmount.DiskSectors,
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
libmount.VFATResult;

/**
 * @typedef {{
 *            bytsPerSec: number,
 *            zeroRegions: !Array<!libmount.ZeroRegion>,
 *            dataSectors: !Array<!libmount.DataSector>,
 *          }}
 */
libmount.DiskSectors;

/**
 * @typedef {{
 *            i: number,
 *            count: number,
 *          }}
 */
libmount.ZeroRegion;

/**
 * @typedef {{
 *            i: number,
 *            data: !Uint8Array,
 *          }}
 */
libmount.DataSector;

/**
 * @typedef {{
 *            active: boolean,
 *            type: number,
 *            relativeSectors: number,
 *            totalSectors: number,
 *          }}
 */
libmount.Partition;

/**
 * @typedef {{
 *            capacity: number,
 *            read: function(number,number):!Uint8Array,
 *            write: (function(number,!Uint8Array):void|void),
 *            close: (function():void|void),
 *          }}
 */
libmount.RandomAccessDriver;
