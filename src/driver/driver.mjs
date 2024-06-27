import { DIR_ENTRY_SIZE, createFATMath } from "./math.mjs";
import { Device, DirEntry, FileSystemDriver, NodeCrawler } from "../types.mjs";
import { DirEntryFlag, createNodeCrawler } from "./node-crawler.mjs";
import { FATNode, FATNodeKind } from "./node.mjs";
import { Logger, assert } from "../support.mjs";
import { loadAndValidateBootSector, loadFATVariables } from "../loaders.mjs";
import { createNodeBee } from "./node-bee.mjs";

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

/**
 * @param {!FATNode} node
 * @returns {number}
 */
function getClusNum(node) {
  return (node.dir.FstClusHI << 16) | node.dir.FstClusLO;
}

/**
 * @implements {FileSystemDriver<!FATNode>}
 */
export class FATDriver {
  /**
   * @param {!Device} device
   * @param {!codec.Codec} coder
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
    /**
     * @private
     * @constant
     */
    this.bee = createNodeBee(device, this.math, coder, this.crawler);
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
    let clusNum = getClusNum(node);
    let size = 0;
    const arr = new Uint8Array(fileSize);
    while (size < fileSize) {
      const offset = this.math.getContentOffset(clusNum);
      if (offset === null) {
        log.warn("wrong FileSize?");
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
   * @returns {?FATNode}
   */
  mkdir(node, name) {
    return this.bee.mkdir(node, name);
  }

  /**
   * @override
   * @param {!FATNode} node
   * @param {string} name
   * @returns {?FATNode}
   */
  mkfile(node, name) {
    return this.bee.mkfile(node, name);
  }

  /**
   * Release all clusters allocated to this node and mark all dir-entries as deleted.
   * @param {!FATNode} node
   */
  unlink(node) {
    let clusNum = getClusNum(node);
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
    for (let i = 0; i < node.dirCount; i++) {
      if (offset === null) {
        log.warn("wrong number of dirs?");
        break;
      }
      // offset is supposed to be 32-bytes aligned
      assert(offset > 0 && offset % DIR_ENTRY_SIZE === 0);
      this.device.seek(offset);
      this.device.writeByte(DirEntryFlag.FREE_ENTRY);
      offset = this.math.getNextDirEntryOffset(offset + DIR_ENTRY_SIZE);
    }
    node.markDeleted();
  }

  /**
   * @returns {string}
   */
  getVolumName() {
    for (const subNode of this.crawler.getSubNodes(this.getRoot())) {
      if (subNode.isVolumeId()) {
        return subNode.longName;
      }
    }
    return this.coder.decode(this.bs.VolLab).trimEnd();
  }
}
