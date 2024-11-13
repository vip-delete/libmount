import { Device, DirEntry, DirEntryLFN, FATMath, NodeCrawler } from "../types.mjs";
import { FATNode, FATNodeKind } from "./node.mjs";
import { getChkSum, isLongNameValidCode, isShortNameValidCode, normalizeLongName, sfnToStr } from "../name-utils.mjs";
import { loadDirEntry, loadDirEntryLFN } from "../loaders.mjs";
import { DIR_ENTRY_SIZE } from "./math.mjs";
import { assert } from "../support.mjs";

const DIR_LN_LAST_LONG_ENTRY = 0x40;

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
 * @param {number} offset
 * @param {number} count
 * @returns {!FATNode}
 */
function getInvalidNode(offset, count) {
  assert(count > 0);
  return new FATNode(FATNodeKind.INVALID, "", "", offset, count, DUMMY_DIR);
}

/**
 * @param {number} offset
 * @returns {!FATNode}
 */
function getLastNode(offset) {
  return new FATNode(FATNodeKind.LAST, "", "", offset, 1, DUMMY_DIR);
}

/**
 * @param {!FATNodeKind} kind
 * @param {string} name
 * @param {number} offset
 * @param {!DirEntry} dir
 * @returns {!FATNode}
 */
function getSimpleNode(kind, name, offset, dir) {
  return new FATNode(kind, name, name, offset, 1, dir);
}

/**
 * @param {!DirEntry} dir
 * @param {number} offset
 * @param {!lm.Codepage} decoder
 * @param {number} flag
 * @param {!Array<!DirEntryLFN>} chain
 * @returns {!FATNode}
 */
function getNode(dir, offset, decoder, flag, chain) {
  if (flag === DirEntryFlag.FREE_ENTRY) {
    // deleted entry
    if (chain.length > 0) {
      return getInvalidNode(offset, chain.length);
    }
    if (dir.Attr === DirEntryAttr.LONG_NAME) {
      return getSimpleNode(FATNodeKind.DELETED_LFN, "", offset, DUMMY_DIR);
    }
    const name = sfnToStr(dir.Name, decoder);
    return getSimpleNode(FATNodeKind.DELETED, name, offset, dir);
  }

  if ((dir.Attr & DirEntryAttr.VOLUME_ID) > 0) {
    // volume entry
    if (chain.length > 0) {
      return getInvalidNode(offset, chain.length);
    }
    const name = decoder.decode(dir.Name).trimEnd();
    return getSimpleNode(FATNodeKind.VOLUME_ID, name, offset, dir);
  }

  if ((dir.Attr & DirEntryAttr.DIRECTORY) > 0 && dir.Name[0] === ".".charCodeAt(0)) {
    // Dot or DotDot entry
    if (chain.length > 0) {
      return getInvalidNode(offset, chain.length);
    }
    const name = decoder.decode(dir.Name).trimEnd();
    if (name === ".") {
      return getSimpleNode(FATNodeKind.DOT_DIR, name, offset, dir);
    } else if (name === "..") {
      return getSimpleNode(FATNodeKind.DOTDOT_DIR, name, offset, dir);
    }
    // invalid dot entry
    return getInvalidNode(offset, 1);
  }

  // regular dirEntry
  const shortName = dir.Name.every(isShortNameValidCode) ? sfnToStr(dir.Name, decoder) : "";
  const shortNameValid = shortName !== "" && !shortName.startsWith(" ");
  if (!shortNameValid) {
    // chain and current entry is invalid
    return getInvalidNode(offset, chain.length + 1);
  }
  const longName = getConnectedLongName(chain, dir);
  const longNameValid = longName !== "" && longName === normalizeLongName(longName);
  if (!longNameValid) {
    // the chain is invalid if exists
    if (chain.length > 0) {
      return getInvalidNode(offset, chain.length);
    }
  }
  const kind = (dir.Attr & DirEntryAttr.DIRECTORY) > 0 ? FATNodeKind.REGULAR_DIR : FATNodeKind.REGULAR_FILE;
  const name = longNameValid ? longName : shortName;
  return new FATNode(kind, name, shortName, offset, chain.length + 1, dir);
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
 * @param {!lm.Codepage} decoder
 * @param  {number} offset
 * @returns {?FATNode}
 */
function getNextNode(device, math, decoder, offset) {
  /**
   * @type {!Array<!DirEntryLFN>}
   */
  const chain = [];
  let currentOffset = offset;
  while (currentOffset !== null) {
    const flag = getFirstByte(device, currentOffset);
    if (flag === DirEntryFlag.LAST_ENTRY) {
      return getLastNode(currentOffset);
    }
    const dir = loadDirEntry(device);
    const lfn = dir.Attr === DirEntryAttr.LONG_NAME && flag !== DirEntryFlag.FREE_ENTRY;
    if (!lfn) {
      return getNode(dir, offset, decoder, flag, chain);
    }

    // LFN
    device.skip(-DIR_ENTRY_SIZE);
    const dirLFN = loadDirEntryLFN(device);
    if (isLastDirEntryLFN(dirLFN)) {
      // a chain just started
      // if there was a chain, then it is invalid
      if (chain.length > 0) {
        return getInvalidNode(offset, chain.length);
      }
    } else {
      if (chain.length === 0) {
        // a chain is empty and current item is not 'last', so it is invalid
        return getInvalidNode(offset, 1);
      }
      const prev = getOrdDirEntryLFN(chain.at(-1));
      const curr = getOrdDirEntryLFN(dirLFN);
      if (prev !== curr + 1) {
        // ord mismatch: the whole chain plus current dirLFN is invalid
        return getInvalidNode(offset, chain.length + 1);
      }
    }

    // the chain is valid
    chain.push(dirLFN);
    currentOffset = math.getNextDirEntryOffset(currentOffset + DIR_ENTRY_SIZE);
  }
  if (chain.length > 0) {
    return getInvalidNode(offset, chain.length);
  }
  return null;
}

/**
 * @param {!FATNode} node
 * @returns {number}
 */
function getClusNum(node) {
  return (node.dir.FstClusHI << 16) | node.dir.FstClusLO;
}

/**
 * @implements {NodeCrawler<!FATNode>}
 */
class FATNodeCrawler {
  /**
   * @param {!Device} device
   * @param {!FATMath} math
   * @param {!lm.Codepage} decoder
   */
  constructor(device, math, decoder) {
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
    this.decoder = decoder;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getFirst(node) {
    if (node.isRoot()) {
      return this.loadFromOffset(this.math.getRootDirOffset());
    }
    if (node.isRegularDir()) {
      const offset = this.math.getContentOffset(getClusNum(node));
      if (offset === null) {
        // directory has a wrong first cluster number?
        return null;
      }
      return this.loadFromOffset(offset);
    }
    // shouldn't be here
    assert(false);
    return null;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getNext(node) {
    if (node.isRoot()) {
      return null;
    }
    const offset = this.math.getNextDirEntryOffset(node.firstDirOffset + node.dirCount * DIR_ENTRY_SIZE);
    if (offset === null) {
      return null;
    }
    return this.loadFromOffset(offset);
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
   * @param {number} offset
   * @returns {?FATNode}
   */
  loadFromOffset(offset) {
    const node = getNextNode(this.device, this.math, this.decoder, offset);
    assert(node === null || node.firstDirOffset === offset);
    assert(node === null || node.dirCount > 0);
    return node;
  }
}

/**
 * @implements {Iterator<!FATNode>}
 * @implements {Iterable<!FATNode>}
 */
class NodeList {
  /**
   * @param {!NodeCrawler<!FATNode>} crawler
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

/**
 * @param {!Device} device
 * @param {!FATMath} math
 * @param {!lm.Codepage} decoder
 * @returns {!NodeCrawler<!FATNode>}
 */
export function createNodeCrawler(device, math, decoder) {
  return new FATNodeCrawler(device, math, decoder);
}
