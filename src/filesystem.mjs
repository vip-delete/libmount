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
   * @param {boolean} isDirectory
   * @returns {?FATFile}
   */
  makeFile(absolutePath, isDirectory) {
    return this.getRoot().makeFile(absolutePath, isDirectory);
  }

  /**
   * @override
   * @param {string} src
   * @param {string} dest
   * @returns {?FATFile}
   */
  moveFile(src, dest) {
    const file = this.getFile(src);
    return file === null ? null : file.moveFile(dest);
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
      if (subNode.isLast()) {
        break;
      }
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
    return traverse(relativePath, this, (file, i, names) => file.findFirst((f) => f.match(names[i])));
  }

  /**
   * @override
   * @param {string} relativePath
   * @param {boolean} isDirectory
   * @returns {?FATFile}
   */
  makeFile(relativePath, isDirectory) {
    return traverse(relativePath, this, (file, i, names) => {
      const node = this.fs.driver.makeNode(file.node, names[i], isDirectory || i < names.length - 1);
      return node === null ? null : file.getChild(node);
    });
  }

  /**
   * @override
   * @param {string} dest
   * @returns {?FATFile}
   */
  moveFile(dest) {
    if (this.node.isRoot()) {
      return null;
    }
    if (!dest.startsWith("/") && !dest.startsWith("\\")) {
      dest = this.absolutePath.substring(0, this.absolutePath.length - this.node.longName.length) + dest;
    }
    if (this.contains(dest)) {
      return null;
    }
    const destFile = this.fs.getFile(dest);
    if (destFile !== null && destFile.node.isRegularFile()) {
      // dest is an existing regular file
      return null;
    }
    const isDirectory = this.node.isRegularDir();
    const target = destFile === null ? this.fs.makeFile(dest, isDirectory) : destFile.makeFile(this.node.longName, isDirectory);
    if (target === null) {
      return null;
    }
    this.fs.driver.moveNode(this.node, target.node);
    return target;
  }

  /**
   * @param {string} absolutePath
   * @returns {boolean}
   */
  contains(absolutePath) {
    if (this.isRegularFile()) {
      return false;
    }
    const srcNames = this.absolutePath.split(/[/\\]/u).filter((it) => it !== "");
    const destNames = absolutePath.split(/[/\\]/u).filter((it) => it !== "");
    let i = this.fs.getRoot();
    let j = this.fs.getRoot();
    let k = 0;
    while (true) {
      if (k === srcNames.length) {
        return true;
      }
      if (k === destNames.length) {
        return false;
      }
      const srcName = srcNames[k];
      const destName = destNames[k];
      const srcChild = i.findFirst((f) => f.match(srcName));
      const destChild = j.findFirst((f) => f.match(destName));
      if (destChild === null) {
        return false;
      }
      if (srcChild.node.firstDirOffset !== destChild.node.firstDirOffset) {
        return false;
      }
      i = srcChild;
      j = destChild;
      k++;
    }
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
}

/**
 * @param {string} path
 * @param {!FATFile} current
 * @param {function(!FATFile,number,!Array<string>):?FATFile} func
 * @returns {?FATFile}
 */
function traverse(path, current, func) {
  let file = current;
  const names = path.split(/[/\\]/u).filter((it) => it !== "");
  let i = 0;
  while (i < names.length && file !== null) {
    file = func(file, i, names);
    i++;
  }
  return file;
}
