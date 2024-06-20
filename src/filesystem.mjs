import { FATDriver, FATNode, FAT_NODE } from "./model.mjs";
import { formatDate, formatDateTime } from "./util.mjs";

/**
 * @implements {LibMount.File}
 */
class FATFile {
  /**
   * @param {string} absolutePath
   * @param {!FATNode} node
   */
  constructor(absolutePath, node) {
    this.absolutePath = absolutePath;
    this.node = node;
  }

  /**
   * @override
   * @returns {string}
   */
  getName() {
    return this.node.getName();
  }

  /**
   * @override
   * @returns {string}
   */
  getShortName() {
    return this.node.shortName;
  }

  /**
   * @override
   * @returns {?string}
   */
  getLongName() {
    return this.node.longName;
  }

  /**
   * @override
   * @returns {string}
   */
  getAbsolutePath() {
    return this.absolutePath;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isRegularFile() {
    return this.node.kind === FAT_NODE.REGULAR_FILE;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isDirectory() {
    return this.node.kind === FAT_NODE.REGULAR_DIR || this.node.kind === FAT_NODE.ROOT;
  }

  /**
   * @override
   * @returns {number}
   */
  getFileSize() {
    return this.node.getFileSize();
  }

  /**
   * @override
   * @returns {string}
   */
  getCreatedDate() {
    const dirEntry = this.node.dirEntry;
    return dirEntry === null ? "" : formatDateTime(dirEntry.CrtDate, dirEntry.CrtTime, dirEntry.CrtTimeTenth);
  }

  /**
   * @override
   * @returns {string}
   */
  getModifiedDate() {
    const dirEntry = this.node.dirEntry;
    return dirEntry === null ? "" : formatDateTime(dirEntry.WrtDate, dirEntry.WrtTime, 0);
  }

  /**
   * @override
   * @returns {string}
   */
  getAccessedDate() {
    const dirEntry = this.node.dirEntry;
    if (dirEntry === null) {
      return "";
    }
    return formatDate(dirEntry.LstAccDate);
  }
}

/**
 * @implements {LibMount.FileSystem}
 */
export class FATFileSystem {
  /**
   * @param {!FATDriver} driver
   */
  constructor(driver) {
    this.driver = driver;
  }

  /**
   * @override
   * @returns {!LibMount.VolumeInfo}
   */
  getVolumeInfo() {
    return this.driver.getVolumeInfo();
  }

  /**
   * @override
   * @returns {!LibMount.File}
   */
  getRoot() {
    return new FATFile("/", this.driver.getRoot());
  }

  /**
   * @override
   * @param {string} path
   * @returns {?LibMount.File}
   */
  getFile(path) {
    const parts = path.split(/[/\\]/);
    let node = this.driver.getRoot();
    let i = 0;
    let absolutePath = "";
    while (i < parts.length && node !== null) {
      const name = parts[i];
      if (name !== "") {
        node = this.findFirstInDir(node, (it) => isNodeRegularFileOrDir(it) && isNodeMatch(it, name));
        if (node !== null) {
          absolutePath += "/" + node.getName();
        }
      }
      i++;
    }
    return node === null ? null : new FATFile(absolutePath, node);
  }

  /**
   * @override
   * @param {!LibMount.File} file
   * @returns {!Array<!LibMount.File>}
   */
  listFiles(file) {
    const f = /** @type {!FATFile} */ (file);
    const parentPath = f.node.kind === FAT_NODE.ROOT ? "" : f.absolutePath;
    return this.findAllInDir(f.node, (it) => isNodeRegularFileOrDir(it)).map((node) => new FATFile(parentPath + "/" + node.getName(), node));
  }

  /**
   * @override
   * @param {!LibMount.File} file
   * @returns {?Uint8Array}
   */
  readFile(file) {
    const f = /** @type {!FATFile} */ (file);
    return this.driver.readNode(f.node);
  }

  /**
   * @override
   * @param {!LibMount.File} file
   */
  deleteFile(file) {
    const f = /** @type {!FATFile} */ (file);
    this.driver.deleteNode(f.node);
  }

  /**
   * @param {!FATNode} dirNode
   * @param {function(!FATNode):boolean} predicate
   * @returns {?FATNode}
   */
  findFirstInDir(dirNode, predicate) {
    let node = this.driver.getFirst(dirNode);
    while (node !== null) {
      if (predicate(node)) {
        return node;
      }
      node = this.driver.getNext(node);
    }
    return null;
  }

  /**
   * @param {!FATNode} dirNode
   * @param {function(!FATNode):boolean} predicate
   * @returns {!Array<!FATNode>}
   */
  findAllInDir(dirNode, predicate) {
    const nodes = [];
    let node = this.driver.getFirst(dirNode);
    while (node !== null) {
      if (predicate(node)) {
        nodes.push(node);
      }
      node = this.driver.getNext(node);
    }
    return nodes;
  }
}

/**
 * @param {!FATNode} node
 * @returns {boolean}
 */
function isNodeRegularFileOrDir(node) {
  return node.kind === FAT_NODE.REGULAR_FILE || node.kind === FAT_NODE.REGULAR_DIR;
}

/**
 * @param {!FATNode} node
 * @param {string} name
 * @returns {boolean}
 */
function isNodeMatch(node, name) {
  const upperCaseName = name.toUpperCase();
  return upperCaseName === node.shortName || (node.longName !== null && node.longName.toUpperCase() === upperCaseName);
}
