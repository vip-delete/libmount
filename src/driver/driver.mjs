import { DIR_ENTRY_SIZE, createFATMath } from "./math.mjs";
import { Device, DirEntry, DirEntryLFN, FileSystemDriver, NodeCrawler } from "../types.mjs";
import { DirEntryAttr, DirEntryFlag, createNodeCrawler } from "./node-crawler.mjs";
import { FATNode, FATNodeKind } from "./node.mjs";
import { Logger, assert } from "../support.mjs";
import { getChkSum, normalizeLongName, strToLfn, strToSfn, strToTildeName } from "../name-utils.mjs";
import { loadAndValidateBootSector, loadFATVariables, writeDirEntry, writeDirEntryLFN } from "../loaders.mjs";
import { toDate, toTime, toTimeTenth } from "../date-utils.mjs";

const log = new Logger("DRIVER");

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

const ROOT_NODE = new FATNode(FATNodeKind.ROOT, "", "", -1, -1, ROOT_DIR_ENTRY);

const DOT_SFN = new Uint8Array([".".charCodeAt(0), 32, 32, 32, 32, 32, 32, 32, 32, 32, 32]);
const DOT_DOT_SFN = new Uint8Array([".".charCodeAt(0), ".".charCodeAt(0), 32, 32, 32, 32, 32, 32, 32, 32, 32]);

/**
 * @param {!FATNode} node
 * @returns {number}
 */
function getFirstClusNum(node) {
  return (node.dir.FstClusHI << 16) | node.dir.FstClusLO;
}

/**
 * @implements {FileSystemDriver<!FATNode>}
 */
export class FATDriver {
  /**
   * @param {!Device} device
   * @param {!lm.Codepage} coder
   */
  constructor(device, coder) {
    /**
     * @private
     * @constant
     */
    this.device = device;
    /**
     * @private
     * @constant
     */
    this.coder = coder;
    device.seek(0);
    /**
     * @private
     * @constant
     */
    this.bs = loadAndValidateBootSector(device);
    /**
     * @private
     * @constant
     */
    this.vars = loadFATVariables(this.bs);
    /**
     * @private
     * @constant
     */
    this.math = createFATMath(device, this.bs.bpb, this.vars);
    /**
     * @private
     * @constant
     */
    this.crawler = createNodeCrawler(device, this.math, coder);
  }

  /**
   * @override
   * @returns {string}
   */
  getFileSystemName() {
    return this.math.getFileSystemName();
  }

  /**
   * @override
   * @returns {!lm.VolumeInfo}
   */
  getVolumeInfo() {
    return {
      label: this.getVolumName(),
      oemName: this.coder.decode(this.bs.oemName).trimEnd(),
      serialNumber: this.bs.VolID,
      clusterSize: this.vars.SizeOfCluster,
      totalClusters: this.vars.CountOfClusters,
      freeClusters: this.math.getFreeClusters(),
    };
  }

  /**
   * @override
   * @returns {!FATNode}
   */
  getRoot() {
    return ROOT_NODE;
  }

  /**
   * @override
   * @returns {!NodeCrawler<!FATNode>}
   */
  getCrawler() {
    return this.crawler;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {?Uint8Array}
   */
  readNode(node) {
    if (!node.isRegularFile()) {
      return null;
    }
    const fileSize = node.dir.FileSize;
    let clusNum = getFirstClusNum(node);
    let size = 0;
    const arr = new Uint8Array(fileSize);
    while (size < fileSize) {
      const offset = this.math.getContentOffset(clusNum);
      if (offset === null) {
        log.warn("readNode: unexpected EOF");
        break;
      }
      const len = Math.min(this.vars.SizeOfCluster, fileSize - size);
      this.device.seek(offset);
      const chunk = this.device.readArray(len);
      arr.set(chunk, size);
      size += len;
      clusNum = this.math.getNextClusNum(clusNum);
    }
    return arr;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {undefined}
   */
  deleteNode(node) {
    if (node.isRegularDir()) {
      // recursively delete directory content.
      for (const subNode of this.crawler.getSubNodes(node)) {
        if (subNode.isLast()) {
          break;
        }
        this.deleteNode(subNode);
      }
    }
    if (node.isRegularDir() || node.isRegularFile()) {
      this.unlink(node);
      this.markNodeDeleted(node);
    }
  }

  /**
   * @override
   * @param {!FATNode} node
   * @param {string} name
   * @param {boolean} isDirectory
   * @returns {?FATNode}
   */
  makeNode(node, name, isDirectory) {
    if (!node.isRoot() && !node.isRegularDir()) {
      log.warn(`'${node.longName}' is not a directory`);
      return null;
    }
    const filename = normalizeLongName(name);
    const fileNames = new Set();
    const existingNode = this.getNodeByFilename(node, filename, fileNames);
    if (existingNode !== null) {
      if (!isDirectory && !existingNode.isRegularFile()) {
        log.warn(`makeNode: '${filename}' exists and not a regular file`);
        return null;
      }
      if (isDirectory && !existingNode.isRegularDir()) {
        log.warn(`makeNode: '${filename}' exists and not a regular dir`);
        return null;
      }
      return existingNode;
    }
    // filename is unique, create a chain with respect to shortNames
    const chain = this.makeChain(filename, fileNames);
    if (chain === null) {
      // filename contains invalid characters
      return null;
    }
    const offset = this.allocate(node, chain.dirLFNs.length + 1);
    if (offset === null) {
      // no free space
      return null;
    }
    if (!isDirectory) {
      return this.writeDirChain(FATNodeKind.REGULAR_FILE, offset, chain);
    }
    // create dot and dotdot dir entries
    {
      const clusters = this.math.allocateClusters(1);
      if (clusters === null) {
        log.warn(`makeNode: no clusters for '${name}'`);
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
      this.math.writeZeros(clusNum);
      this.device.seek(off);
      writeDirEntry(this.device, createDotTypeDirEntry(DOT_SFN, chain.dir));
      writeDirEntry(this.device, createDotTypeDirEntry(DOT_DOT_SFN, node.dir));
    }
    return this.writeDirChain(FATNodeKind.REGULAR_DIR, offset, chain);
  }

  /**
   * @override
   * @param {!FATNode} src
   * @param {!FATNode} dest
   */
  moveNode(src, dest) {
    if (src.firstDirOffset === dest.firstDirOffset) {
      // nothing to move
      return;
    }
    // seek to the last dir
    let offset = dest.firstDirOffset;
    let i = 0;
    while (offset !== null && i < dest.dirCount - 1) {
      offset = this.math.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE);
      i++;
    }
    if (offset === null) {
      log.warn(`moveNode: wrong number of dirs for ${dest.longName}`);
      return;
    }
    this.unlink(dest);
    this.device.seek(offset);
    dest.dir.CrtTimeTenth = src.dir.CrtTimeTenth;
    dest.dir.CrtTime = src.dir.CrtTime;
    dest.dir.CrtDate = src.dir.CrtDate;
    dest.dir.LstAccDate = src.dir.LstAccDate;
    dest.dir.FstClusHI = src.dir.FstClusHI;
    dest.dir.WrtTime = src.dir.WrtTime;
    dest.dir.WrtDate = src.dir.WrtDate;
    dest.dir.FstClusLO = src.dir.FstClusLO;
    dest.dir.FileSize = src.dir.FileSize;
    writeDirEntry(this.device, dest.dir);
    this.markNodeDeleted(src);
  }

  /**
   * Release all clusters allocated to this node.
   * @param {!FATNode} node
   */
  unlink(node) {
    let clusNum = getFirstClusNum(node);
    while (this.math.isAllocated(clusNum)) {
      const nextClusNum = this.math.getNextClusNum(clusNum);
      this.math.setNextClusNum(clusNum, 0);
      clusNum = nextClusNum;
    }
  }

  /**
   * @param {!FATNode} node
   */
  markNodeDeleted(node) {
    let offset = node.firstDirOffset;
    // mark all elements in the chain by setting 0xE5 to the first byte
    // it is possible that the chain spans across multiple non-contiguous clusters
    let i = 0;
    while (offset !== null && i < node.dirCount) {
      this.device.seek(offset);
      this.device.writeByte(DirEntryFlag.FREE_ENTRY);
      offset = this.math.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE);
      i++;
    }
    node.markDeleted();
  }

  /**
   * @returns {string}
   */
  getVolumName() {
    for (const subNode of this.crawler.getSubNodes(this.getRoot())) {
      if (subNode.isLast()) {
        break;
      }
      if (subNode.isVolumeId()) {
        return subNode.longName;
      }
    }
    return this.coder.decode(this.bs.VolLab).trimEnd();
  }

  /**
   * Allocated 'dirCount' entries in the given node
   * @param {!FATNode} node
   * @param {number} dirCount
   * @returns {?number} offset or null if cannot allocate
   */
  allocate(node, dirCount) {
    assert(node.isRoot() || node.isRegularDir());
    let offset = 0;
    let allocated = 0;
    let lastOffset = null;
    for (const subNode of this.crawler.getSubNodes(node)) {
      lastOffset = subNode.firstDirOffset;
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
    // otherwise we should have found the free dirEntries chain
    assert(dirCount > allocated);
    if (lastOffset === null) {
      // impossible
      assert(false);
      return null;
    }
    // find the last cluster number
    let lastClusNum = this.math.getClusNum(lastOffset);
    if (lastClusNum === null) {
      // root directory on FAT12 and FAT16 has no clusters
      return null;
    }
    // the number of bytes left to allocate
    const allocateSize = (dirCount - allocated) * DIR_ENTRY_SIZE;
    assert(allocateSize > 0);
    const allocateClusCount = 1 + Math.floor((allocateSize - 1) / this.vars.SizeOfCluster);
    const clusters = this.math.allocateClusters(allocateClusCount);
    if (clusters === null) {
      log.warn(`allocate: no clusters for '${node.longName}'`);
      return null;
    }
    assert(clusters.length > 0);
    // write zeros
    for (let i = 0; i < clusters.length; i++) {
      const clusNum = clusters[i];
      assert(this.math.isAllocated(clusNum));
      this.math.writeZeros(clusNum);
    }
    assert(this.math.isAllocated(lastClusNum));
    let lastAllocatedClusNum = lastClusNum;
    while (this.math.isAllocated(lastClusNum)) {
      lastAllocatedClusNum = lastClusNum;
      lastClusNum = this.math.getNextClusNum(lastClusNum);
    }
    // attach the chain of new clusters to the last cluster
    this.math.setNextClusNum(lastAllocatedClusNum, clusters[0]);
    return allocated > 0 ? offset : this.math.getContentOffset(clusters[0]);
  }

  /**
   * @param {!FATNode} node
   * @param {string} filename
   * @param {!Set<string>} fileNames
   * @returns {?FATNode}
   */
  getNodeByFilename(node, filename, fileNames) {
    const filenameUpper = filename.toUpperCase();
    for (const subNode of this.crawler.getSubNodes(node)) {
      if (subNode.isLast()) {
        break;
      }
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
   * @param {string} filename
   * @param {!Set<string>} fileNames
   * @returns {?DirChain}
   */
  makeChain(filename, fileNames) {
    // by design we are creating a chain for non-existing filename
    // fileNames contains long- and short- names in upper case
    assert(!fileNames.has(filename.toUpperCase()));
    // try to create a single node chain
    const sfn = strToSfn(filename, this.coder);
    if (sfn !== null) {
      // filename is a correct short name: not need LFN
      return { longName: filename, shortName: filename, dirLFNs: [], dir: createDirEntry(sfn) };
    }
    // we have to create LFN chain
    const lfn = strToLfn(filename);
    if (lfn === null) {
      log.warn(`makeChain: '${filename}' is not valid filename`);
      return null;
    }
    // try to not use a tilde-like name
    const simpleSfn = strToSfn(filename.toUpperCase(), this.coder);
    if (simpleSfn !== null) {
      // uppercase filename is a correct short name and it is not used
      const chkSum = getChkSum(simpleSfn);
      return { longName: filename, shortName: filename.toUpperCase(), dirLFNs: createDirEntryLFNs(lfn, chkSum), dir: createDirEntry(simpleSfn) };
    }
    // we have to use tilde-like name
    const tildeName = strToTildeName(filename, this.coder, fileNames);
    if (tildeName === null) {
      // namespace overflow (impossible)
      assert(false);
      return null;
    }
    const tildeSfn = strToSfn(tildeName, this.coder);
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
   * @param {number} firstDirOffset
   * @param {!DirChain} chain
   * @returns {?FATNode}
   */
  writeDirChain(kind, firstDirOffset, chain) {
    let offset = firstDirOffset;
    let i = chain.dirLFNs.length - 1;
    while (offset !== null && i >= 0) {
      this.device.seek(offset);
      writeDirEntryLFN(this.device, chain.dirLFNs[i]);
      offset = this.math.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE);
      i--;
    }
    if (offset === null) {
      // impossible
      assert(false);
      return null;
    }
    this.device.seek(offset);
    writeDirEntry(this.device, chain.dir);
    return new FATNode(kind, chain.longName, chain.shortName, firstDirOffset, chain.dirLFNs.length + 1, chain.dir);
  }
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
 * @typedef {{
 *            longName: string,
 *            shortName: string,
 *            dirLFNs: !Array<!DirEntryLFN>,
 *            dir: !DirEntry,
 *          }}
 */
const DirChain = {};
