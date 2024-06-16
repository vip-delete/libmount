"use strict";

class FATChainLN {
  constructor() {
    /**
     * @type {!Array<!DirEntryLN>}
     */
    this.list = [];
  }

  /**
   * @param {!DirEntryLN} dir
   */
  addDirLN(dir) {
    const last = (dir.Ord & DIR_LN_LAST_LONG_ENTRY) !== 0;
    if (last) {
      this.list = [dir];
      return;
    }
    if (this.list.length === 0) {
      return;
    }
    const prev = this.list[this.list.length - 1].Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
    const curr = dir.Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
    if (prev == curr + 1) {
      this.list.push(dir);
      return;
    }
    this.clear();
  }

  /**
   * @param {!DirEntry} dir
   */
  addDir(dir) {
    if (this.list.length === 0) {
      return;
    }
    const k = this.list.length - 1;
    const ord = this.list[k].Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
    if (ord !== 1 || this.list[k].Chksum !== NameUtil.getChkSum(dir.Name)) {
      this.clear();
    }
  }

  /**
   * @return {undefined}
   */
  clear() {
    this.list.length = 0;
  }

  /**
   * @returns {number}
   */
  size() {
    return this.list.length;
  }

  /**
   * @returns {?string}
   */
  getLongName() {
    if (this.list.length === 0) {
      return null;
    }
    let longName = "";
    let k = this.list.length - 1;
    while (k >= 0) {
      const dir = this.list[k];
      /**
       * @type {!Array<!Uint8Array>}
       */
      const arr = [dir.Name1, dir.Name2, dir.Name3];
      for (let i = 0; i < arr.length; i++) {
        const part = arr[i];
        for (let j = 0; j < part.length; j += 2) {
          const b1 = part[j];
          const b2 = part[j + 1];
          if (b1 === 0 && b2 === 0) {
            return longName;
          }
          const ch = b1 | (b2 << 8);
          longName += String.fromCharCode(ch);
        }
      }
      k--;
    }
    return longName;
  }
}
