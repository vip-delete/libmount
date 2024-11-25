import { DIR_ENTRY_SIZE, Device, DirEntry, DirEntryLFN, FATCrawler, FATDriver, FATMath, FATNode } from "../types.mjs";
import { DirEntryAttr, DirEntryFlag, FATCrawlerImpl, FATNodeKind, ROOT_NODE, createFATNode } from "./crawler.mjs";
import { FAT12Math, FAT16Math, FAT32Math } from "./math.mjs";
import { Logger, assert, impossibleNull } from "../support.mjs";
import {
  OEM_NAME_LENGTH,
  VOL_LAB_LENGTH,
  loadAndValidateBootSector,
  loadAndValidateFSInfo,
  loadFATVariables,
  writeBootSector,
  writeDirEntry,
  writeDirEntryLFN,
} from "../loaders.mjs";
import { getChkSum, normalizeLongName, strToLfn, strToSfn, strToTildeName } from "../name-utils.mjs";
import { toDate, toTime, toTimeTenth } from "../date-utils.mjs";

const log = new Logger("DRIVER");

const DOT_SFN = new Uint8Array([
  //
  ".".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
]);

const DOT_DOT_SFN = new Uint8Array([
  //
  ".".charCodeAt(0),
  ".".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
]);

const NO_NAME_SFN = new Uint8Array([
  "N".charCodeAt(0),
  "O".charCodeAt(0),
  " ".charCodeAt(0),
  "N".charCodeAt(0),
  "A".charCodeAt(0),
  "M".charCodeAt(0),
  "E".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
  " ".charCodeAt(0),
]);

/**
 * @param {!FATNode} node
 * @returns {number}
 */
function getFirstClusNum(node) {
  return (node.getDirEntry().FstClusHI << 16) | node.getDirEntry().FstClusLO;
}

/**
 * @param {!FATNode} node
 * @param {!FATMath} math
 * @returns {?number}
 */
function getLastDirOffset(node, math) {
  const skip = node.getDirCount() - 1;
  let offset = node.getFirstDirOffset();
  let i = 0;
  while (offset !== null && i < skip) {
    offset = math.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE);
    i++;
  }
  if (offset === null) {
    log.warn(`wrong number of dirs for ${node.getLongName()}`);
  }
  return offset;
}

/**
 * @implements {FATDriver}
 */
export class FATDriverImpl {
  /**
   * @param {!Device} device
   * @param {!lm.Codepage} codepage
   */
  constructor(device, codepage) {
    /**
     * @private
     * @constant
     */
    this.device = device;
    /**
     * @private
     * @constant
     */
    this.codepage = codepage;
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
    this.math = this.createFATMath();
    /**
     * @private
     * @constant
     */
    this.crawler = new FATCrawlerImpl(device, this.math, codepage);

    /**
     * @private
     * @constant
     */
    this.volume = new FATVolumeImpl(this);
  }

  /**
   * @private
   * @returns {!FATMath}
   */
  createFATMath() {
    if (this.vars.CountOfClusters < 4085) {
      // A FAT12 volume cannot contain more than 4084 clusters.
      return new FAT12Math(this.device, this.bs.bpb, this.vars);
    }
    if (this.vars.CountOfClusters < 65525) {
      // A FAT16 volume cannot contain less than 4085 clusters or more than 65,524 clusters.
      return new FAT16Math(this.device, this.bs.bpb, this.vars);
    }
    this.device.seek(this.bs.bpb.BytsPerSec);
    const fsi = loadAndValidateFSInfo(this.device);
    return new FAT32Math(this.device, this.bs.bpb, this.vars, fsi);
  }

  /**
   * @override
   * @returns {string}
   */
  getFileSystemName() {
    if (this.vars.CountOfClusters < 4085) {
      return "FAT12";
    }
    if (this.vars.CountOfClusters < 65525) {
      return "FAT16";
    }
    return "FAT32";
  }

  /**
   * @override
   * @returns {!lm.Volume}
   */
  getVolume() {
    return this.volume;
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
   * @returns {!FATCrawler}
   */
  getCrawler() {
    return this.crawler;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {number}
   */
  getSizeOnDisk(node) {
    if (node.isRoot()) {
      const clusNum = this.math.getClusNum(this.math.getRootDirOffset());
      const clusCount = clusNum === null ? 0 : this.getClusterChainLength(clusNum);
      return clusCount * this.vars.SizeOfCluster + this.getSubNodesSizeOnDisk(node);
    }
    if (node.isRegularFile() || node.isRegularDir()) {
      const clusCount = this.getClusterChainLength(getFirstClusNum(node));
      const subNodesSizeOnDisk = node.isRegularFile() ? 0 : this.getSubNodesSizeOnDisk(node);
      return clusCount * this.vars.SizeOfCluster + subNodesSizeOnDisk;
    }
    return 0;
  }

  /**
   * @private
   * @param {number} clusNum
   * @returns {number}
   */
  getClusterChainLength(clusNum) {
    let count = 0;
    while (this.math.isAllocated(clusNum)) {
      count++;
      clusNum = this.math.getNextClusNum(clusNum);
    }
    return count;
  }

  /**
   * @private
   * @param {!FATNode} node
   * @returns {number}
   */
  getSubNodesSizeOnDisk(node) {
    assert(node.isRoot() || node.isRegularDir());
    let subNodesSizeOnDisk = 0;
    for (const subNode of this.crawler.getSubNodes(node)) {
      subNodesSizeOnDisk += this.getSizeOnDisk(subNode);
    }
    return subNodesSizeOnDisk;
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
    const fileSize = node.getDirEntry().FileSize;
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
   * @param {!Uint8Array} data
   * @returns {?FATNode}
   */
  writeNode(node, data) {
    if (!node.isRegularFile()) {
      return null;
    }
    const lastDirOffset = getLastDirOffset(node, this.math);
    if (lastDirOffset === null) {
      return null;
    }
    let firstClusNum = 0;
    const dir = node.getDirEntry();
    if (data.length > 0) {
      const clusCount = Math.ceil(data.length / this.vars.SizeOfCluster);
      assert(clusCount > 0);
      const clusters = this.math.allocateClusters(clusCount);
      if (clusters === null) {
        // no free space
        return null;
      }
      // write the data to the allocated clusters
      assert(clusCount === clusters.length);
      for (let i = 0; i < clusters.length; i++) {
        const offset = this.math.getContentOffset(clusters[i]);
        if (offset === null) {
          return impossibleNull();
        }
        this.device.seek(offset);
        const begin = i * this.vars.SizeOfCluster;
        const end = Math.min(begin + this.vars.SizeOfCluster, data.length);
        this.device.writeArray(data.subarray(begin, end));
      }
      firstClusNum = clusters[0];
    }
    this.unlink(node);
    dir.FstClusLO = firstClusNum & 0xffff;
    dir.FstClusHI = firstClusNum >> 16;
    dir.FileSize = data.length;
    this.device.seek(lastDirOffset);
    writeDirEntry(this.device, dir);
    return node;
  }

  /**
   * @override
   * @param {!FATNode} node
   * @returns {undefined}
   */
  deleteNode(node) {
    if (node.isRoot() || node.isRegularDir()) {
      // recursively delete directory content.
      for (const subNode of this.crawler.getSubNodes(node)) {
        if (subNode.isLast()) {
          break;
        }
        this.deleteNode(subNode);
      }
      if (node.isRoot()) {
        const rootClusNum = this.math.getClusNum(this.math.getRootDirOffset());
        if (rootClusNum === null) {
          // FAT12, FAT16
          return;
        }
        // FAT32: delele all clusters, writeZeros to the root cluster, add a label
        const label = this.volume.getLabel();
        let clusNum = rootClusNum;
        while (this.math.isAllocated(clusNum)) {
          const nextClusNum = this.math.getNextClusNum(clusNum);
          this.math.setFreeClusNum(clusNum);
          clusNum = nextClusNum;
        }
        this.math.writeZeros(rootClusNum);
        this.math.setFinalClusNum(rootClusNum);
        this.volume.setLabel(label);
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
      log.warn(`'${node.getLongName()}' is not a directory`);
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
        return impossibleNull();
      }
      this.math.writeZeros(clusNum);
      this.device.seek(off);
      writeDirEntry(this.device, createDotTypeDirEntry(DOT_SFN, chain.dir));
      writeDirEntry(this.device, createDotTypeDirEntry(DOT_DOT_SFN, node.getDirEntry()));
    }
    return this.writeDirChain(FATNodeKind.REGULAR_DIR, offset, chain);
  }

  /**
   * @override
   * @param {!FATNode} src
   * @param {!FATNode} dest
   */
  moveNode(src, dest) {
    if (src.getFirstDirOffset() === dest.getFirstDirOffset()) {
      // nothing to move
      return;
    }
    // seek to the last dir
    const offset = getLastDirOffset(dest, this.math);
    if (offset === null) {
      return;
    }
    this.unlink(dest);
    this.device.seek(offset);
    const srcDir = src.getDirEntry();
    const destDir = dest.getDirEntry();
    destDir.CrtTimeTenth = srcDir.CrtTimeTenth;
    destDir.CrtTime = srcDir.CrtTime;
    destDir.CrtDate = srcDir.CrtDate;
    destDir.LstAccDate = srcDir.LstAccDate;
    destDir.FstClusHI = srcDir.FstClusHI;
    destDir.WrtTime = srcDir.WrtTime;
    destDir.WrtDate = srcDir.WrtDate;
    destDir.FstClusLO = srcDir.FstClusLO;
    destDir.FileSize = srcDir.FileSize;
    writeDirEntry(this.device, destDir);
    this.markNodeDeleted(src);
  }

  /**
   * Release all clusters allocated to this node.
   * @private
   * @param {!FATNode} node
   */
  unlink(node) {
    assert(node.isRegularDir() || node.isRegularFile());
    let clusNum = getFirstClusNum(node);
    while (this.math.isAllocated(clusNum)) {
      const nextClusNum = this.math.getNextClusNum(clusNum);
      this.math.setFreeClusNum(clusNum);
      clusNum = nextClusNum;
    }
  }

  // /**
  //  * @private
  //  * @param {!FATNode} node
  //  */
  // getClusNums(node) {
  //   const clusNums = [];
  //   let clusNum = getFirstClusNum(node);
  //   while (this.math.isAllocated(clusNum)) {
  //     clusNums.push(clusNum);
  //     clusNum = this.math.getNextClusNum(clusNum);
  //   }
  //   return clusNums;
  // }

  /**
   * @param {!FATNode} node
   */
  markNodeDeleted(node) {
    let offset = node.getFirstDirOffset();
    // mark all elements in the chain by setting 0xE5 to the first byte
    // it is possible that the chain spans across multiple non-contiguous clusters
    let i = 0;
    while (offset !== null && i < node.getDirCount()) {
      this.device.seek(offset);
      this.device.writeByte(DirEntryFlag.FREE_ENTRY);
      offset = this.math.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE);
      i++;
    }
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
      lastOffset = subNode.getFirstDirOffset();
      const free = subNode.isDeleted() || subNode.isDeletedLFN() || subNode.isInvalid() || subNode.isLast();
      if (free) {
        if (allocated === 0) {
          offset = subNode.getFirstDirOffset();
        }
        allocated += subNode.getDirCount();
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
      return impossibleNull();
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
      log.warn(`allocate: no clusters for '${node.getLongName()}'`);
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
        const longName = subNode.getLongName().toUpperCase();
        const shortName = subNode.getShortName().toUpperCase();
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
    const sfn = strToSfn(filename, this.codepage);
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
    const simpleSfn = strToSfn(filename.toUpperCase(), this.codepage);
    if (simpleSfn !== null) {
      // uppercase filename is a correct short name and it is not used
      const chkSum = getChkSum(simpleSfn);
      return { longName: filename, shortName: filename.toUpperCase(), dirLFNs: createDirEntryLFNs(lfn, chkSum), dir: createDirEntry(simpleSfn) };
    }
    // we have to use tilde-like name
    const tildeName = strToTildeName(filename, this.codepage, fileNames);
    if (tildeName === null) {
      // namespace overflow
      return impossibleNull();
    }
    const tildeSfn = strToSfn(tildeName, this.codepage);
    if (tildeSfn === null) {
      // impossible, strToTildeName has to create a correct short name
      return impossibleNull();
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
      return impossibleNull();
    }
    this.device.seek(offset);
    writeDirEntry(this.device, chain.dir);
    return createFATNode(kind, chain.longName, chain.shortName, firstDirOffset, offset, chain.dirLFNs.length + 1, chain.dir);
  }
}

/**
 * @implements {lm.Volume}
 */
class FATVolumeImpl {
  /**
   * @param {!FATDriverImpl} driver
   */
  constructor(driver) {
    /**
     * @private
     * @constant
     */
    this.driver = driver;
  }

  /**
   * @override
   * @returns {?string}
   */
  getLabel() {
    const node = this.getVolumeLabelNode();
    return node === null ? this.driver.codepage.decode(this.driver.bs.VolLab).trimEnd() : node.getLongName();
  }

  /**
   * @override
   * @param {?string} label
   * @returns {undefined}
   */
  setLabel(label) {
    const node = this.getVolumeLabelNode();
    if (label === null) {
      if (node !== null) {
        this.driver.markNodeDeleted(node);
      }
      this.driver.bs.VolLab = NO_NAME_SFN;
      this.writeBootSector();
      return;
    }
    const sfn = this.getShortName(label, VOL_LAB_LENGTH);
    if (node === null) {
      const dir = createVolumeIdTypeDirEntry(sfn);
      const offset = this.driver.allocate(this.driver.getRoot(), 1);
      if (offset !== null) {
        this.driver.device.seek(offset);
        writeDirEntry(this.driver.device, dir);
      }
    } else {
      const dir = node.getDirEntry();
      dir.Name = sfn;
      this.driver.device.seek(node.getFirstDirOffset());
      writeDirEntry(this.driver.device, dir);
    }
    this.driver.bs.VolLab = sfn;
    this.writeBootSector();
  }

  /**
   * @override
   * @returns {?string}
   */
  getOEMName() {
    return this.driver.codepage.decode(this.driver.bs.oemName).trimEnd();
  }

  /**
   * @override
   * @param {?string} oemName
   * @returns {undefined}
   */
  setOEMName(oemName) {
    this.driver.bs.oemName = this.getShortName(oemName, OEM_NAME_LENGTH);
    this.writeBootSector();
  }

  /**
   * @override
   * @returns {number}
   */
  getId() {
    return this.driver.bs.VolID;
  }

  /**
   * @override
   * @param {number} id
   * @returns {undefined}
   */
  setId(id) {
    this.driver.bs.VolID = id >>> 0;
    this.writeBootSector();
  }

  /**
   * @override
   * @returns {number}
   */
  getSizeOfCluster() {
    return this.driver.vars.SizeOfCluster;
  }

  /**
   * @override
   * @returns {number}
   */
  getCountOfClusters() {
    return this.driver.vars.CountOfClusters;
  }

  /**
   * @override
   * @returns {number}
   */
  getFreeClusters() {
    return this.driver.math.getFreeClusters();
  }

  // Private

  /**
   * @private
   * @returns {?FATNode}
   */
  getVolumeLabelNode() {
    for (const subNode of this.driver.getCrawler().getSubNodes(this.driver.getRoot())) {
      if (subNode.isLast()) {
        break;
      }
      if (subNode.isVolumeId()) {
        return subNode;
      }
    }
    return null;
  }

  /**
   * @private
   * @param {?string} name
   * @param {number} length
   * @returns {!Uint8Array}
   */
  getShortName(name, length) {
    const sfn = new Uint8Array(Array(length).fill(32));
    if (name !== null) {
      const encoded = this.driver.codepage.encode(name.substring(0, 11).trimEnd()).subarray(0, length);
      sfn.set(encoded);
    }
    return sfn;
  }

  /**
   * @returns {undefined}
   */
  writeBootSector() {
    this.driver.device.seek(0);
    writeBootSector(this.driver.device, this.driver.bs);
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
 * @param {!Uint8Array} sfn
 * @returns {!DirEntry}
 */
function createVolumeIdTypeDirEntry(sfn) {
  return {
    Name: sfn,
    Attr: DirEntryAttr.VOLUME_ID,
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
