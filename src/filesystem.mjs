import { parseDate, parseDateTime } from "./date-utils.mjs";
import { FATNode } from "./driver/node.mjs";
import { FileSystemDriver } from "./types.mjs";
import { normalizeLongName } from "./name-utils.mjs";

/**
 * @implements {lm.FileSystem}
 */
export class FATFileSystem {
  /**
   * @param {!FileSystemDriver<!FATNode>} driver
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
   * @returns {string}
   */
  getName() {
    return this.driver.getFileSystemName();
  }

  /**
   * @override
   * @returns {!lm.VolumeInfo}
   */
  getVolumeInfo() {
    return this.driver.getVolumeInfo();
  }

  /**
   * @override
   * @returns {!FATFile}
   */
  getRoot() {
    return new FATFile(this, "/", this.driver.getRoot());
  }

  /**
   * @override
   * @param {string} absolutePath
   * @returns {?FATFile}
   */
  getFile(absolutePath) {
    return this.getRoot().getFile(absolutePath);
  }

  /**
   * @override
   * @param {string} absolutePath
   * @returns {?lm.File}
   */
  mkdir(absolutePath) {
    return this.getRoot().mkdir(absolutePath);
  }

  /**
   * @override
   * @param {string} absolutePath
   * @returns {?lm.File}
   */
  mkfile(absolutePath) {
    return this.getRoot().mkfile(absolutePath);
  }
}

/**
 * @implements {lm.File}
 */
class FATFile {
  /**
   * @param {!FATFileSystem} fs
   * @param {string} absolutePath
   * @param {!FATNode} node
   */
  constructor(fs, absolutePath, node) {
    /**
     * @private
     * @constant
     */
    this.fs = fs;
    /**
     * @private
     * @constant
     */
    this.absolutePath = absolutePath;
    /**
     * @private
     * @constant
     */
    this.node = node;
  }

  /**
   * @override
   * @returns {string}
   */
  getName() {
    return this.node.longName;
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
    return this.node.isRegularFile();
  }

  /**
   * @override
   * @returns {boolean}
   */
  isDirectory() {
    return this.node.isRegularDir() || this.node.isRoot();
  }

  /**
   * @override
   * @returns {number}
   */
  length() {
    return this.node.dir.FileSize;
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @returns {!Date}
   */
  lastModified() {
    const dir = this.node.dir;
    return new Date(parseDateTime(dir.WrtDate, dir.WrtTime, 0));
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @returns {!Date}
   */
  creationTime() {
    const dir = this.node.dir;
    return new Date(parseDateTime(dir.CrtDate, dir.CrtTime, dir.CrtTimeTenth));
  }

  /**
   * yyyy.MM.dd
   * @override
   * @returns {!Date}
   */
  lastAccessTime() {
    const dir = this.node.dir;
    return new Date(parseDate(dir.LstAccDate));
  }

  /**
   * @override
   * @param {function(!FATFile):boolean} predicate
   * @returns {?FATFile}
   */
  findFirst(predicate) {
    if (!this.isDirectory()) {
      return null;
    }
    for (const subNode of this.fs.driver.getCrawler().getSubNodes(this.node)) {
      if (subNode.isRegularDir() || subNode.isRegularFile()) {
        const file = this.getChild(subNode);
        if (predicate(file)) {
          return file;
        }
      }
    }
    return null;
  }

  /**
   * @override
   * @param {function(!FATFile):boolean} predicate
   * @returns {?Array<!FATFile>}
   */
  findAll(predicate) {
    if (!this.isDirectory()) {
      return null;
    }
    const files = [];
    this.findFirst((f) => {
      if (predicate(f)) {
        files.push(f);
      }
      return false;
    });
    return files;
  }

  /**
   * @override
   * @returns {?Array<!FATFile>}
   */
  listFiles() {
    return this.findAll(() => true);
  }

  /**
   * @override
   * @returns {?Uint8Array}
   */
  getData() {
    return this.fs.driver.readNode(this.node);
  }

  /**
   * @override
   */
  delete() {
    this.fs.driver.deleteNode(this.node);
  }

  /**
   * @override
   * @param {string} relativePath
   * @returns {?FATFile}
   */
  getFile(relativePath) {
    return traverse(relativePath, this, (file, name) => file.findFirst((f) => f.match(name)));
  }

  /**
   * @override
   * @param {string} relativePath
   * @returns {?FATFile}
   */
  mkdir(relativePath) {
    return traverse(relativePath, this, (file, name) => file.getChildOrNull(this.fs.driver.mkdir(file.node, name)));
  }

  /**
   * @override
   * @param {string} relativePath
   * @returns {?FATFile}
   */
  mkfile(relativePath) {
    return traverse(relativePath, this, (file, name, i, names) => {
      if (i < names.length - 1) {
        return file.getChildOrNull(this.fs.driver.mkdir(file.node, name));
      }
      return file.getChildOrNull(this.fs.driver.mkfile(file.node, name));
    });
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  match(name) {
    const upperCaseName = normalizeLongName(name).toUpperCase();
    return upperCaseName === this.node.longName.toUpperCase() || upperCaseName === this.node.shortName.toUpperCase();
  }

  /**
   * @param {!FATNode} node
   * @returns {!FATFile}
   */
  getChild(node) {
    const absolutePath = this.node.isRoot() ? "/" + node.longName : this.absolutePath + "/" + node.longName;
    return new FATFile(this.fs, absolutePath, node);
  }

  /**
   * @param {?FATNode} node
   * @returns {?FATFile}
   */
  getChildOrNull(node) {
    return node === null ? null : this.getChild(node);
  }
}

/**
 * @param {string} path
 * @param {!FATFile} current
 * @param {function(!FATFile,string,number,!Array<string>):?FATFile} func
 * @returns {?FATFile}
 */
function traverse(path, current, func) {
  let item = current;
  const names = path.split(/[/\\]/u).filter((it) => it !== "");
  let i = 0;
  while (i < names.length && item !== null) {
    const name = names[i];
    item = func(item, name, i, names);
    i++;
  }
  return item;
}
