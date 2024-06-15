"use strict";

const NameUtil = {
  /**
   * @param {number} ch
   * @returns {boolean}
   */
  isCharValid(ch) {
    return (
      ch > 127 || //
      (ch >= "A".charCodeAt(0) && ch <= "Z".charCodeAt(0)) ||
      (ch >= "0".charCodeAt(0) && ch <= "9".charCodeAt(0)) ||
      " $%'-_@~`!(){}^#&".includes(String.fromCharCode(ch))
    );
  },

  /**
   * @param {!Uint8Array} arr
   * @returns {boolean}
   */
  isNameValid(arr) {
    let i = 0;
    while (i < arr.length && NameUtil.isCharValid(arr[i])) i++;
    return i == arr.length;
  },

  /**
   * @param {!Uint8Array} arr
   * @returns {number}
   */
  getChkSum(arr) {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum = (((sum & 1) === 1 ? 0x80 : 0) + (sum >> 1) + arr[i]) & 0xff;
    }
    return sum;
  },

  /**
   * @param {!Uint8Array} arr
   * @returns {string}
   */
  getRawName(arr) {
    // TODO: we need a codepage for chars > 127
    return new TextDecoder().decode(arr).trim();
  },

  /**
   * @param {!Uint8Array} arr
   * @returns {string}
   */
  getShortName(arr) {
    const filename = NameUtil.getRawName(arr.subarray(0, 8)).trim();
    const ext = NameUtil.getRawName(arr.subarray(8, 11)).trim();
    if (ext === "") {
      return filename;
    }
    return filename + "." + ext;
  },
};

const MountUtil = {
  /**
   * @param {!ArrayBuffer} buf
   * @returns {?FATFileSystem}
   */
  mount(buf) {
    const s = new BlockDevice(buf);

    // check signature
    s.pos = 510;
    const sig = s.readWord();
    if (sig != 0xaa55) {
      return null;
    }

    // load boot sector
    s.pos = 0;
    const bs = BootSector.load(s);

    // calculate variables which are used in specification
    const vars = new FATVariables(bs);

    // A FAT12 volume cannot contain more than 4084 clusters.
    if (vars.CountOfClusters < 4085) {
      const driver = new FATDriver(s, bs, vars);
      return new FATFileSystem(driver);
    }

    // A FAT16 volume cannot contain less than 4085 clusters or more than 65,524 clusters.
    if (vars.CountOfClusters < 65525) {
      return null;
    }

    // FAT32
    return null;
  },
};
