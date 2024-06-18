import { FATDriver, FATNode, FAT_NODE } from "./model.mjs";
import { DateUtil } from "./util.mjs";

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
    return this.node.type === FAT_NODE.REGULAR_FILE;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isDirectory() {
    return this.node.type === FAT_NODE.REGULAR_DIR || this.node.type === FAT_NODE.ROOT;
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
    return dirEntry === null ? "" : getDateTile(dirEntry.CrtDate, dirEntry.CrtTime, dirEntry.CrtTimeTenth);
  }

  /**
   * @override
   * @returns {string}
   */
  getModifiedDate() {
    const dirEntry = this.node.dirEntry;
    return dirEntry === null ? "" : getDateTile(dirEntry.WrtDate, dirEntry.WrtTime, 0);
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
    return DateUtil.formatDate(dirEntry.LstAccDate);
  }
}

/**
 * @param {number} date
 * @param {number} time
 * @param {number} timeTenth
 * @returns {string}
 */
function getDateTile(date, time, timeTenth) {
  const dateStr = DateUtil.formatDate(date);
  if (dateStr === "") {
    return "";
  }
  const timeStr = DateUtil.formatTime(time, timeTenth);
  return dateStr + " " + timeStr;
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
    const parentPath = f.node.type === FAT_NODE.ROOT ? "" : f.absolutePath;
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
  return node.type === FAT_NODE.REGULAR_FILE || node.type === FAT_NODE.REGULAR_DIR;
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
