import { DIR_ENTRY_SIZE, Device, DirEntry, DirEntryLFN, FATCrawler, FATMath, FATNode } from "../types.mjs";
import { assert, impossibleNull } from "../support.mjs";
import { getChkSum, isLongNameValidCode, isShortNameValidCode, normalizeLongName, sfnToStr } from "../name-utils.mjs";
import { loadDirEntry, loadDirEntryLFN } from "../loaders.mjs";

const DIR_LN_LAST_LONG_ENTRY = 0x40;

/**
 * @enum
 */
export const FATNodeKind = {
  ROOT: 0,
  REGULAR_DIR: 1,
  REGULAR_FILE: 2,
  VOLUME_ID: 3,
  DOT_DIR: 4,
  DOTDOT_DIR: 5,
  INVALID: 6,
  DELETED: 7,
  DELETED_LFN: 8,
  LAST: 9,
};

/**
 * @type {!DirEntry}
 */
const ROOT_DIR_ENTRY = {
  Name: new Uint8Array(0),
  Attr: 0,
  NTRes: 0,
  CrtTimeTenth: 0,
  CrtTime: 0,
  CrtDate: 0,
  LstAccDate: 0,
  FstClusHI: 0,
  WrtTime: 0,
  WrtDate: 0,
  FstClusLO: 0,
  FileSize: 0,
};

/**
 * @implements {FATNode}
 */
class FATNodeImpl {
  /**
   * @param {!FATNodeKind} kind
   * @param {string} longName
   * @param {string} shortName
   * @param {number} firstDirOffset
   * @param {number} lastDirOffset
   * @param {number} dirCount
   * @param {!DirEntry} dir
   */
  constructor(kind, longName, shortName, firstDirOffset, lastDirOffset, dirCount, dir) {
    /**
     * @private
     * @constant
     */
    this.kind = kind;
    /**
     * @private
     * @constant
     */
    this.longName = longName;
    /**
     * @private
     * @constant
     */
    this.shortName = shortName;
    /**
     * @private
     * @constant
     */
    this.firstDirOffset = firstDirOffset;
    /**
     * @private
     * @constant
     */
    this.lastDirOffset = lastDirOffset;
    /**
     * @private
     * @constant
     */
    this.dirCount = dirCount;
    /**
     * @private
     * @constant
     */
    this.dir = dir;
    assert(dir !== null);
  }

  /**
   * @override
   * @returns {string}
   */
  getLongName() {
    return this.longName;
  }

  /**
   * @override
   * @returns {string}
   */
  getShortName() {
    return this.shortName;
  }

  /**
   * @override
   * @returns {number}
   */
  getFirstDirOffset() {
    return this.firstDirOffset;
  }

  /**
   * @override
   * @returns {number}
   */
  getLastDirOffset() {
    return this.lastDirOffset;
  }

  /**
   * @override
   * @returns {number}
   */
  getDirCount() {
    return this.dirCount;
  }

  /**
   * @override
   * @returns {!DirEntry}
   */
  getDirEntry() {
    return this.dir;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isRoot() {
    return this.kind === FATNodeKind.ROOT;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isRegularDir() {
    return this.kind === FATNodeKind.REGULAR_DIR;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isRegularFile() {
    return this.kind === FATNodeKind.REGULAR_FILE;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isVolumeId() {
    return this.kind === FATNodeKind.VOLUME_ID;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isDot() {
    return this.kind === FATNodeKind.DOT_DIR;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isDotDot() {
    return this.kind === FATNodeKind.DOTDOT_DIR;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isInvalid() {
    return this.kind === FATNodeKind.INVALID;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isDeleted() {
    return this.kind === FATNodeKind.DELETED;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isDeletedLFN() {
    return this.kind === FATNodeKind.DELETED_LFN;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isLast() {
    return this.kind === FATNodeKind.LAST;
  }
}

/**
 * @param {!FATNodeKind} kind
 * @param {string} longName
 * @param {string} shortName
 * @param {number} firstDirOffset
 * @param {number} lastDirOffset
 * @param {number} dirCount
 * @param {!DirEntry} dir
 * @returns {!FATNode}
 */
export function createFATNode(kind, longName, shortName, firstDirOffset, lastDirOffset, dirCount, dir) {
  return new FATNodeImpl(kind, longName, shortName, firstDirOffset, lastDirOffset, dirCount, dir);
}

export const ROOT_NODE = createFATNode(FATNodeKind.ROOT, "", "", -1, -1, -1, ROOT_DIR_ENTRY);

/**
 * @enum
 */
export const DirEntryFlag = {
  LAST_ENTRY: 0x00,
  FREE_ENTRY: 0xe5,
};

/**
 * @enum
 */
export const DirEntryAttr = {
  READ_ONLY: 0x01,
  HIDDEN: 0x02,
  SYSTEM: 0x04,
  VOLUME_ID: 0x08,
  DIRECTORY: 0x10,
  ARCHIVE: 0x20,
  // READ_ONLY | HIDDEN | SYSTEM | VOLUME_ID
  LONG_NAME: 0xf,
};

/**
 * @type {!DirEntry}
 */
const DUMMY_DIR = {
  Name: new Uint8Array(11),
  Attr: 0,
  NTRes: 0,
  CrtTimeTenth: 0,
  CrtTime: 0,
  CrtDate: 0,
  LstAccDate: 0,
  FstClusHI: 0,
  WrtTime: 0,
  WrtDate: 0,
  FstClusLO: 0,
  FileSize: 0,
};

/**
 * @param {!DirEntryLFN} dirLFN
 * @returns {boolean}
 */
function isLastDirEntryLFN(dirLFN) {
  return (dirLFN.Ord & DIR_LN_LAST_LONG_ENTRY) > 0;
}

/**
 * @param {!DirEntryLFN} dirLFN
 * @returns {number}
 */
function getOrdDirEntryLFN(dirLFN) {
  return dirLFN.Ord & (DIR_LN_LAST_LONG_ENTRY - 1);
}

/**
 * @param  {!Array<!DirEntryLFN>} chain
 * @param  {number} chksum
 * @returns {boolean}
 */
function isChkSumMatch(chain, chksum) {
  return chain.every((it) => it.Chksum === chksum);
}

/**
 * @param {!Array<!DirEntryLFN>} chain
 * @param {!DirEntry} dir
 * @returns {boolean}
 */
function isConnected(chain, dir) {
  return chain.length > 0 && getOrdDirEntryLFN(chain.at(-1)) === 1 && isChkSumMatch(chain, getChkSum(dir.Name));
}

/**
 * @param {!Array<!DirEntryLFN>} chain
 * @param {!DirEntry} dir
 * @returns {string}
 */
function getConnectedLongName(chain, dir) {
  if (!isConnected(chain, dir)) {
    return "";
  }
  let longName = "";
  let k = chain.length - 1;
  while (k >= 0) {
    const dirLFN = chain[k];
    /**
     * @type {!Array<!Uint8Array>}
     */
    const arr = [dirLFN.Name1, dirLFN.Name2, dirLFN.Name3];
    for (let i = 0; i < arr.length; i++) {
      const part = arr[i];
      for (let j = 0; j < part.length; j += 2) {
        const b1 = part[j];
        const b2 = part[j + 1];
        if (b1 === 0 && b2 === 0) {
          return longName;
        }
        const ch = b1 | (b2 << 8);
        if (!isLongNameValidCode(ch)) {
          return "";
        }
        longName += String.fromCharCode(ch);
      }
    }
    k--;
  }
  return longName;
}

/**
 * @param {number} firstDirOffset
 * @param {number} lastDirOffset
 * @param {number} count
 * @returns {!FATNode}
 */
function getInvalidNode(firstDirOffset, lastDirOffset, count) {
  assert(count > 0);
  return createFATNode(FATNodeKind.INVALID, "", "", firstDirOffset, lastDirOffset, count, DUMMY_DIR);
}

/**
 * @param {number} firstDirOffset
 * @returns {!FATNode}
 */
function getLastNode(firstDirOffset) {
  return createFATNode(FATNodeKind.LAST, "", "", firstDirOffset, firstDirOffset, 1, DUMMY_DIR);
}

/**
 * @param {!FATNodeKind} kind
 * @param {string} name
 * @param {number} firstDirOffset
 * @param {!DirEntry} dir
 * @returns {!FATNode}
 */
function getSimpleNode(kind, name, firstDirOffset, dir) {
  return createFATNode(kind, name, name, firstDirOffset, firstDirOffset, 1, dir);
}

/**
 * @param {!DirEntry} dir
 * @param {number} firstDirOffset
 * @param {number} lastDirOffset
 * @param {!lm.Codepage} codepage
 * @param {number} flag
 * @param {!Array<!DirEntryLFN>} chain
 * @returns {!FATNode}
 */
function getNode(dir, firstDirOffset, lastDirOffset, codepage, flag, chain) {
  if (flag === DirEntryFlag.FREE_ENTRY) {
    // deleted entry
    if (chain.length > 0) {
      return getInvalidNode(firstDirOffset, lastDirOffset, chain.length);
    }
    if (dir.Attr === DirEntryAttr.LONG_NAME) {
      return getSimpleNode(FATNodeKind.DELETED_LFN, "", firstDirOffset, DUMMY_DIR);
    }
    const name = sfnToStr(dir.Name, codepage);
    return getSimpleNode(FATNodeKind.DELETED, name, firstDirOffset, dir);
  }

  if ((dir.Attr & DirEntryAttr.VOLUME_ID) > 0) {
    // volume entry
    if (chain.length > 0) {
      return getInvalidNode(firstDirOffset, lastDirOffset, chain.length);
    }
    const name = codepage.decode(dir.Name).trimEnd();
    return getSimpleNode(FATNodeKind.VOLUME_ID, name, firstDirOffset, dir);
  }

  if ((dir.Attr & DirEntryAttr.DIRECTORY) > 0 && dir.Name[0] === ".".charCodeAt(0)) {
    // Dot or DotDot entry
    if (chain.length > 0) {
      return getInvalidNode(firstDirOffset, lastDirOffset, chain.length);
    }
    const name = codepage.decode(dir.Name).trimEnd();
    if (name === ".") {
      return getSimpleNode(FATNodeKind.DOT_DIR, name, firstDirOffset, dir);
    } else if (name === "..") {
      return getSimpleNode(FATNodeKind.DOTDOT_DIR, name, firstDirOffset, dir);
    }
    // invalid dot entry
    return getInvalidNode(firstDirOffset, lastDirOffset, 1);
  }

  // regular dirEntry
  const shortName = dir.Name.every(isShortNameValidCode) ? sfnToStr(dir.Name, codepage) : "";
  const shortNameValid = shortName !== "" && !shortName.startsWith(" ");
  if (!shortNameValid) {
    // chain and current entry is invalid
    // log.warn("");
    return getInvalidNode(firstDirOffset, lastDirOffset, chain.length + 1);
  }
  const longName = getConnectedLongName(chain, dir);
  const longNameValid = longName !== "" && longName === normalizeLongName(longName);
  if (!longNameValid) {
    // the chain is invalid if exists
    if (chain.length > 0) {
      // log.warn("");
      return getInvalidNode(firstDirOffset, lastDirOffset, chain.length);
    }
  }
  const kind = (dir.Attr & DirEntryAttr.DIRECTORY) > 0 ? FATNodeKind.REGULAR_DIR : FATNodeKind.REGULAR_FILE;
  const name = longNameValid ? longName : shortName;
  return new FATNodeImpl(kind, name, shortName, firstDirOffset, lastDirOffset, chain.length + 1, dir);
}

/**
 * @param {!Device} device
 * @param  {number} offset
 * @returns {number}
 */
function getFirstByte(device, offset) {
  assert(offset > 0 && offset % DIR_ENTRY_SIZE === 0, `Offset ${offset} is not ${DIR_ENTRY_SIZE} bytes aligned`);
  device.seek(offset);

  const flag = device.readByte();
  device.skip(-1);
  return flag;
}

/**
 * @param {!Device} device
 * @param {!FATMath} math
 * @param {!lm.Codepage} codepage
 * @param  {number} firstDirOffset
 * @returns {?FATNode}
 */
function getNextNode(device, math, codepage, firstDirOffset) {
  /**
   * @type {!Array<!DirEntryLFN>}
   */
  const chain = [];
  let offset = firstDirOffset;
  let lastDirOffset = firstDirOffset;
  while (offset !== null) {
    lastDirOffset = offset;
    const flag = getFirstByte(device, offset);
    if (flag === DirEntryFlag.LAST_ENTRY) {
      // if there was a chain, then it is invalid
      if (chain.length > 0) {
        return getInvalidNode(firstDirOffset, lastDirOffset, chain.length);
      }
      return getLastNode(firstDirOffset);
    }
    const dir = loadDirEntry(device);
    const lfn = dir.Attr === DirEntryAttr.LONG_NAME && flag !== DirEntryFlag.FREE_ENTRY;
    if (!lfn) {
      return getNode(dir, firstDirOffset, lastDirOffset, codepage, flag, chain);
    }

    // LFN
    device.skip(-DIR_ENTRY_SIZE);
    const dirLFN = loadDirEntryLFN(device);
    if (isLastDirEntryLFN(dirLFN)) {
      // a chain just started
      // if there was a chain, then it is invalid
      if (chain.length > 0) {
        return getInvalidNode(firstDirOffset, lastDirOffset, chain.length);
      }
    } else {
      if (chain.length === 0) {
        // a chain is empty and current item is not 'last', so it is invalid
        return getInvalidNode(firstDirOffset, lastDirOffset, 1);
      }
      const prev = getOrdDirEntryLFN(chain.at(-1));
      const curr = getOrdDirEntryLFN(dirLFN);
      if (prev !== curr + 1) {
        // ord mismatch: the whole chain plus current dirLFN is invalid
        return getInvalidNode(firstDirOffset, lastDirOffset, chain.length + 1);
      }
    }

    // the chain is valid
    chain.push(dirLFN);
    offset = math.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE);
  }
  if (chain.length > 0) {
    return getInvalidNode(firstDirOffset, lastDirOffset, chain.length);
  }
  return null;
}

/**
 * @param {!FATNode} node
 * @returns {number}
 */
function getClusNum(node) {
  // if (node.getDirEntry() === null) {
  //   debugger;
  // }
  return (node.getDirEntry().FstClusHI << 16) | node.getDirEntry().FstClusLO;
}

/**
 * @implements {FATCrawler}
 */
export class FATCrawlerImpl {
  /**
   * @param {!Device} device
   * @param {!FATMath} math
   * @param {!lm.Codepage} codepage
   */
  constructor(device, math, codepage) {
    /**
     * @private
     * @constant
     */
    this.device = device;
    /**
     * @private
     * @constant
     */
    this.math = math;
    /**
     * @private
     * @constant
     */
    this.codepage = codepage;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {!Iterable<!FATNode>}
   */
  getSubNodes(node) {
    return new NodeList(this, this.getFirst(node));
  }

  /**
   * @private
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getFirst(node) {
    if (node.isRoot()) {
      return this.loadFromOffset(this.math.getRootDirOffset());
    }
    if (!node.isRegularDir()) {
      return impossibleNull();
    }
    const offset = this.math.getContentOffset(getClusNum(node));
    if (offset === null) {
      // directory has a wrong first cluster number?
      return null;
    }
    return this.loadFromOffset(offset);
  }

  /**
   * @private
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getNext(node) {
    if (node.isRoot()) {
      return null;
    }
    const offset = this.math.getNextDirEntryOffset(node.getLastDirOffset() + DIR_ENTRY_SIZE);
    if (offset === null) {
      return null;
    }
    return this.loadFromOffset(offset);
  }

  /**
   * @private
   * @param {number} offset
   * @returns {?FATNode}
   */
  loadFromOffset(offset) {
    const node = getNextNode(this.device, this.math, this.codepage, offset);
    assert(node === null || node.getFirstDirOffset() === offset);
    assert(node === null || node.getDirCount() > 0);
    return node;
  }
}

/**
 * @implements {Iterator<!FATNode>}
 * @implements {Iterable<!FATNode>}
 */
class NodeList {
  /**
   * @param {!FATCrawlerImpl} crawler
   * @param {?FATNode} first
   */
  constructor(crawler, first) {
    /**
     * @private
     * @constant
     */
    this.crawler = crawler;
    /**
     * @private
     */
    this.value = first;
  }

  /**
   * @override
   * @returns {!IIterableResult}
   */
  next() {
    const value = this.value;
    const ret = {
      value,
      done: value === null,
    };
    if (value !== null) {
      this.value = this.crawler.getNext(value);
    }
    return ret;
  }

  [Symbol.iterator]() {
    return this;
  }
}