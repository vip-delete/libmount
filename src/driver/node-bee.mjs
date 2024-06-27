import { Device, DirChain, DirEntry, DirEntryLFN, FATMath, NodeBee, NodeCrawler } from "../types.mjs";
import { FATNode, FATNodeKind } from "./node.mjs";
import { Logger, assert } from "../support.mjs";
import { getChkSum, normalizeLongName, strToLfn, strToSfn, strToTildeName } from "../name-utils.mjs";
import { toDate, toTime, toTimeTenth } from "../date-utils.mjs";
import { writeDirEntry, writeDirEntryLFN } from "../loaders.mjs";
import { DIR_ENTRY_SIZE } from "./math.mjs";
import { DirEntryAttr } from "./node-crawler.mjs";

const log = new Logger("DRIVER");

const DOT_SFN = new Uint8Array([".".charCodeAt(0), 32, 32, 32, 32, 32, 32, 32, 32, 32, 32]);
const DOTDOT_SFN = new Uint8Array([".".charCodeAt(0), ".".charCodeAt(0), 32, 32, 32, 32, 32, 32, 32, 32, 32]);

/**
 * @param {!Iterable<!FATNode>} subNodes
 * @param {string} filename
 * @param {!Set<string>} fileNames
 * @returns {?FATNode}
 */
function getNodeByFilename(subNodes, filename, fileNames) {
  const filenameUpper = filename.toUpperCase();
  for (const subNode of subNodes) {
    if (subNode.isRegularDir() || subNode.isRegularFile()) {
      const longName = subNode.longName.toUpperCase();
      const shortName = subNode.shortName.toUpperCase();
      if (filenameUpper === longName || filenameUpper === shortName) {
        return subNode;
      }
      fileNames.add(longName);
      fileNames.add(shortName);
    }
  }
  return null;
}

/**
 * @param {!Iterable<!FATNode>} subNodes
 * @param {number} dirCount
 * @returns {?number}
 */
function allocateInPlace(subNodes, dirCount) {
  let offset = 0;
  let allocated = 0;
  for (const subNode of subNodes) {
    const free = subNode.isDeleted() || subNode.isDeletedLFN() || subNode.isInvalid() || subNode.isLast();
    if (free) {
      if (allocated === 0) {
        offset = subNode.firstDirOffset;
      }
      allocated += subNode.dirCount;
      if (allocated >= dirCount) {
        return offset;
      }
    } else {
      allocated = 0;
    }
  }
  // nothing found
  return null;
}

/**
 * @param {!Uint8Array} Name
 * @returns {!DirEntry}
 */
function createDirEntry(Name) {
  const now = new Date();
  const date = toDate(now);
  const time = toTime(now);
  const timeTenth = toTimeTenth(now);
  return {
    Name,
    Attr: 0,
    NTRes: 0,
    CrtTimeTenth: timeTenth,
    CrtTime: time,
    CrtDate: date,
    LstAccDate: date,
    FstClusHI: 0,
    WrtTime: time,
    WrtDate: date,
    FstClusLO: 0,
    FileSize: 0,
  };
}

/**
 * @param {!Uint8Array} sfn
 * @param {!DirEntry} dir
 * @returns {!DirEntry}
 */
function createDotTypeDirEntry(sfn, dir) {
  return {
    Name: sfn,
    Attr: DirEntryAttr.DIRECTORY,
    NTRes: 0,
    CrtTimeTenth: dir.CrtTimeTenth,
    CrtTime: dir.CrtTime,
    CrtDate: dir.CrtDate,
    LstAccDate: dir.LstAccDate,
    FstClusHI: dir.FstClusHI,
    WrtTime: dir.WrtTime,
    WrtDate: dir.WrtDate,
    FstClusLO: dir.FstClusLO,
    FileSize: 0,
  };
}

/**
 * @param {!DirEntry} dir
 * @returns {!DirEntry}
 */
function createDotDirEntry(dir) {
  return createDotTypeDirEntry(DOT_SFN, dir);
}

/**
 * @param {!DirEntry} dir
 * @returns {!DirEntry}
 */
function createDotDotDirEntry(dir) {
  return createDotTypeDirEntry(DOTDOT_SFN, dir);
}

/**
 * @param {!Uint8Array} lfn
 * @param {number} Chksum
 * @returns {!Array<!DirEntryLFN>}
 */
function createDirEntryLFNs(lfn, Chksum) {
  /**
   * @type {!Array<!DirEntryLFN>}
   */
  const dirLFNs = [];
  const Attr = DirEntryAttr.LONG_NAME;
  let i = 0;
  while (i < lfn.length) {
    const Name1 = new Uint8Array(10);
    const Name2 = new Uint8Array(12);
    const Name3 = new Uint8Array(4);
    Name1.fill(0xff);
    Name2.fill(0xff);
    Name3.fill(0xff);
    Name1.set(lfn.subarray(i, i + 10));
    Name2.set(lfn.subarray(i + 10, i + 22));
    Name3.set(lfn.subarray(i + 22, i + 26));
    const count = lfn.length - i;
    assert(count % 2 === 0);
    // set NULL if required
    if (count < 10) {
      Name1[count] = 0;
      Name1[count + 1] = 0;
    } else if (count < 22) {
      Name2[count - 10] = 0;
      Name2[count - 10 + 1] = 0;
    } else if (count < 26) {
      Name3[count - 22] = 0;
      Name3[count - 22 + 1] = 0;
    }
    const Ord = 1 + dirLFNs.length;
    assert(Ord < 0x40);
    dirLFNs.push({
      Ord,
      Name1,
      Attr,
      Type: 0,
      Chksum,
      Name2,
      FstClusLO: 0,
      Name3,
    });
    i += 26;
  }
  dirLFNs.at(-1).Ord |= 0x40;
  return dirLFNs;
}

/**
 * @param {string} filename
 * @param {!codec.Codec} encoder
 * @param {!Set<string>} fileNames
 * @returns {?DirChain}
 */
function mkchain(filename, encoder, fileNames) {
  // by design we are creating a chain for a non-existing filename
  // fileNames contains long- and short- names in upper case
  assert(!fileNames.has(filename.toUpperCase()));
  // try to create a single node chain
  const sfn = strToSfn(filename, encoder);
  if (sfn !== null) {
    // filename is a correct short name: not need LFN
    return { longName: filename, shortName: filename, dirLFNs: [], dir: createDirEntry(sfn) };
  }
  // we have to create LFN chain
  const lfn = strToLfn(filename);
  if (lfn === null) {
    log.warn(`mkchain: '${filename}' is not valid filename`);
    return null;
  }
  // try to not use a tilde-like name
  const simpleSfn = strToSfn(filename.toUpperCase(), encoder);
  if (simpleSfn !== null) {
    // uppercase filename is a correct short name and it is not used
    const chkSum = getChkSum(simpleSfn);
    return { longName: filename, shortName: filename.toUpperCase(), dirLFNs: createDirEntryLFNs(lfn, chkSum), dir: createDirEntry(simpleSfn) };
  }
  // we have to use tilde-like name
  const tildeName = strToTildeName(filename, encoder, fileNames);
  if (tildeName === null) {
    // namespace overflow (impossible)
    assert(false);
    return null;
  }
  const tildeSfn = strToSfn(tildeName, encoder);
  if (tildeSfn === null) {
    // impossible, strToTildeName has to create a correct short name
    assert(false);
    return null;
  }
  const chkSum = getChkSum(tildeSfn);
  return { longName: filename, shortName: tildeName, dirLFNs: createDirEntryLFNs(lfn, chkSum), dir: createDirEntry(tildeSfn) };
}

/**
 * @param {!FATNodeKind} kind
 * @param {!Device} device
 * @param {!FATMath} math
 * @param {?number} offset
 * @param {!DirChain} chain
 * @returns {?FATNode}
 */
function writeDirChain(kind, device, math, offset, chain) {
  let i = chain.dirLFNs.length - 1;
  while (offset !== null && i >= 0) {
    device.seek(offset);
    writeDirEntryLFN(device, chain.dirLFNs[i]);
    offset = math.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE);
    i--;
  }
  if (offset !== null) {
    device.seek(offset);
    writeDirEntry(device, chain.dir);
    return new FATNode(kind, chain.longName, chain.shortName, offset, chain.dirLFNs.length + 1, chain.dir);
  }
  // impossible
  assert(false);
  return null;
}

/**
 * @implements {NodeBee<!FATNode>}
 */
class FATNodeBee {
  /**
   * @param {!Device} device
   * @param {!FATMath} math
   * @param {!codec.Codec} decoder
   * @param {!NodeCrawler} crawler
   */
  constructor(device, math, decoder, crawler) {
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
    /**
     * @private
     * @constant
     */
    this.crawler = crawler;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @param {string} name
   * @returns {?FATNode}
   */
  mkdir(node, name) {
    if (!node.isRoot() && !node.isRegularDir()) {
      log.warn(`mkdir: '${node.longName}' is not a directory`);
      return null;
    }
    const filename = normalizeLongName(name);
    const fileNames = new Set();
    const existingNode = getNodeByFilename(this.crawler.getSubNodes(node), filename, fileNames);
    if (existingNode !== null) {
      if (existingNode.isRegularDir()) {
        return existingNode;
      }
      log.warn(`mkdir: existing node '${filename}' is not a regular dir`);
      return null;
    }
    // filename is unique, create a chain with respect to shortNames
    const chain = mkchain(filename, this.decoder, fileNames);
    if (chain === null) {
      return null;
    }
    const offset = allocateInPlace(this.crawler.getSubNodes(node), chain.dirLFNs.length + 1);
    if (offset === null) {
      log.warn(`mkdir: no dir space for '${name}'`);
      return null;
    }
    // create dot and dotdot dir entries
    {
      const clusters = this.math.allocateClusters(1);
      if (clusters === null) {
        log.warn(`mkdir: no free space for '${name}'`);
        return null;
      }
      const clusNum = clusters[0];
      chain.dir.FstClusLO = clusNum & 0xffff;
      chain.dir.FstClusHI = clusNum >> 16;
      chain.dir.Attr = DirEntryAttr.DIRECTORY;
      const off = this.math.getContentOffset(clusNum);
      if (off === null) {
        // impossible
        assert(false);
        return null;
      }
      this.device.seek(off);
      this.device.writeArray(new Uint8Array(this.math.getClusterSize()));
      this.device.seek(off);
      writeDirEntry(this.device, createDotDirEntry(chain.dir));
      writeDirEntry(this.device, createDotDotDirEntry(node.dir));
    }
    return writeDirChain(FATNodeKind.REGULAR_DIR, this.device, this.math, offset, chain);
  }

  /**
   * @override
   * @param {!FATNode} node
   * @param {string} name
   * @returns {?FATNode}
   */
  mkfile(node, name) {
    if (!node.isRoot() && !node.isRegularDir()) {
      log.warn(`mkdir: '${node.longName}' is not a directory`);
      return null;
    }
    const filename = normalizeLongName(name);
    const fileNames = new Set();
    const existingNode = getNodeByFilename(this.crawler.getSubNodes(node), filename, fileNames);
    if (existingNode !== null) {
      if (existingNode.isRegularFile()) {
        return existingNode;
      }
      log.warn(`mkdir: existing node '${filename}' is not a regular file`);
      return null;
    }
    const chain = mkchain(filename, this.decoder, fileNames);
    if (chain === null) {
      return null;
    }
    const offset = allocateInPlace(this.crawler.getSubNodes(node), chain.dirLFNs.length + 1);
    if (offset === null) {
      // need to allocate a new cluster
      log.warn(`mkdir: no dir space for '${name}'`);
      return null;
    }
    return writeDirChain(FATNodeKind.REGULAR_FILE, this.device, this.math, offset, chain);
  }
}

/**
 * @param {!Device} device
 * @param {!FATMath} math
 * @param {!codec.Codec} decoder
 * @param {!NodeCrawler} crawler
 * @returns {!NodeBee<!FATNode>}
 */
export function createNodeBee(device, math, decoder, crawler) {
  return new FATNodeBee(device, math, decoder, crawler);
}
