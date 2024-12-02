import { impossibleZero } from "./support.mjs";
import { FATDriver, FATNode } from "./types.mjs";
import { normalizeLongName, parseDate, parseDateTime, split } from "./utils.mjs";

/**
 * @implements {lmNS.FileSystem}
 */
export class FATFileSystem {
  /**
   * @param {!FATDriver} driver
   */
  constructor(driver) {
    /**
     * @constant
     */
    this.driver = driver;
  }

  /**
   * @override
   * @returns {string}
   */
  // @ts-ignore
  getName() {
    return this.driver.getFileSystemName();
  }

  /**
   * @override
   * @returns {!lmNS.Volume}
   */
  // @ts-ignore
  getVolume() {
    return this.driver.getVolume();
  }

  /**
   * @override
   * @returns {!FATFile}
   */
  // @ts-ignore
  getRoot() {
    return new FATFile(this, "/", this.driver.getRoot());
  }
}

/**
 * @implements {lmNS.File}
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
  // @ts-ignore
  getName() {
    return this.node.getLongName();
  }

  /**
   * @override
   * @returns {string}
   */
  // @ts-ignore
  getShortName() {
    return this.node.getShortName();
  }

  /**
   * @override
   * @returns {string}
   */
  // @ts-ignore
  getAbsolutePath() {
    return this.absolutePath;
  }

  /**
   * @override
   * @returns {boolean}
   */
  // @ts-ignore
  isRegularFile() {
    return this.node.isRegularFile();
  }

  /**
   * @override
   * @returns {boolean}
   */
  // @ts-ignore
  isDirectory() {
    return this.node.isRegularDir() || this.node.isRoot();
  }

  /**
   * @override
   * @returns {number}
   */
  // @ts-ignore
  length() {
    if (this.isDirectory()) {
      const ls = this.listFiles();
      if (ls === null) {
        return impossibleZero();
      }
      let length = 0;
      for (let i = 0; i < ls.length; i++) {
        length += ls[i].length();
      }
      return length;
    }
    return this.node.getDirEntry().FileSize;
  }

  /**
   * @override
   * @returns {number}
   */
  // @ts-ignore
  getSizeOnDisk() {
    return this.fs.driver.getSizeOnDisk(this.node);
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @returns {?Date}
   */
  // @ts-ignore
  lastModified() {
    const dir = this.node.getDirEntry();
    return parseDateTime(dir.WrtDate, dir.WrtTime, 0);
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @returns {?Date}
   */
  // @ts-ignore
  creationTime() {
    const dir = this.node.getDirEntry();
    return parseDateTime(dir.CrtDate, dir.CrtTime, dir.CrtTimeTenth);
  }

  /**
   * yyyy.MM.dd
   * @override
   * @returns {?Date}
   */
  // @ts-ignore
  lastAccessTime() {
    const dir = this.node.getDirEntry();
    return parseDate(dir.LstAccDate);
  }

  /**
   * @override
   * @param {function(!FATFile):boolean} predicate
   * @returns {?FATFile}
   */
  // @ts-ignore
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
  // @ts-ignore
  findAll(predicate) {
    if (!this.isDirectory()) {
      return null;
    }
    /**
     * @type {!Array<!FATFile>}
     */
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
  // @ts-ignore
  listFiles() {
    return this.findAll(() => true);
  }

  /**
   * @override
   * @returns {?Uint8Array}
   */
  // @ts-ignore
  getData() {
    return this.fs.driver.readNode(this.node);
  }

  /**
   * @override
   * @param {!Uint8Array} data
   * @returns {?FATFile}
   */
  // @ts-ignore
  setData(data) {
    const node = this.fs.driver.writeNode(this.node, data);
    return node === null ? null : this;
  }

  /**
   * @override
   */
  // @ts-ignore
  delete() {
    this.fs.driver.deleteNode(this.node);
  }

  /**
   * @override
   * @param {string} relativePath
   * @returns {?FATFile}
   */
  // @ts-ignore
  getFile(relativePath) {
    return traverse(relativePath, this, (file, i, names) => file.findFirst((f) => f.match(names[i])));
  }

  /**
   * @override
   * @param {string} relativePath
   * @returns {?FATFile}
   */
  // @ts-ignore
  makeFile(relativePath) {
    return this.makeFileOrDirectory(relativePath, false);
  }

  /**
   * @override
   * @param {string} relativePath
   * @returns {?FATFile}
   */
  // @ts-ignore
  makeDir(relativePath) {
    return this.makeFileOrDirectory(relativePath, true);
  }

  /**
   * @override
   * @param {string} dest
   * @returns {?FATFile}
   */
  // @ts-ignore
  moveTo(dest) {
    if (this.node.isRoot()) {
      return null;
    }
    if (!dest.startsWith("/") && !dest.startsWith("\\")) {
      dest = this.absolutePath.substring(0, this.absolutePath.length - this.node.getLongName().length) + dest;
    }
    if (this.contains(dest)) {
      return null;
    }
    const destFile = this.fs.getRoot().getFile(dest);
    if (destFile !== null && destFile.node.isRegularFile()) {
      // dest is an existing regular file
      return null;
    }
    const isDirectory = this.node.isRegularDir();
    const target =
      destFile === null //
        ? this.fs.getRoot().makeFileOrDirectory(dest, isDirectory)
        : destFile.makeFileOrDirectory(this.node.getLongName(), isDirectory);
    if (target === null) {
      return null;
    }
    this.fs.driver.moveNode(this.node, target.node);
    return target;
  }

  /**
   * @private
   * @param {string} relativePath
   * @param {boolean} isDirectory
   * @returns {?FATFile}
   */
  makeFileOrDirectory(relativePath, isDirectory) {
    return traverse(relativePath, this, (file, i, names) => {
      const node = this.fs.driver.makeNode(file.node, names[i], isDirectory || i < names.length - 1);
      return node === null ? null : file.getChild(node);
    });
  }

  /**
   * @private
   * @param {string} absolutePath
   * @returns {number}
   */
  contains(absolutePath) {
    if (this.isRegularFile()) {
      return 0;
    }
    const srcNames = split(this.absolutePath);
    const destNames = split(absolutePath);
    let i = this.fs.getRoot();
    let j = this.fs.getRoot();
    let k = 0;
    while (true) {
      if (k === srcNames.length) {
        return 1;
      }
      if (k === destNames.length) {
        return 0;
      }
      const srcName = srcNames[k];
      const destName = destNames[k];
      const srcChild = i.findFirst((f) => f.match(srcName));
      const destChild = j.findFirst((f) => f.match(destName));
      if (srcChild === null) {
        return impossibleZero();
      }
      if (destChild === null) {
        return 0;
      }
      if (srcChild.node.getFirstDirOffset() !== destChild.node.getFirstDirOffset()) {
        return 0;
      }
      i = srcChild;
      j = destChild;
      k++;
    }
  }

  /**
   * @private
   * @param {string} name
   * @returns {boolean}
   */
  match(name) {
    const upperCaseName = normalizeLongName(name).toUpperCase();
    return upperCaseName === this.node.getLongName().toUpperCase() || upperCaseName === this.node.getShortName().toUpperCase();
  }

  /**
   * @private
   * @param {!FATNode} node
   * @returns {!FATFile}
   */
  getChild(node) {
    const absolutePath = this.node.isRoot() ? "/" + node.getLongName() : this.absolutePath + "/" + node.getLongName();
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
  /**
   * @type {?FATFile}
   */
  let file = current;
  const names = split(path);
  let i = 0;
  while (i < names.length && file !== null) {
    file = func(file, i, names);
    i++;
  }
  return file;
}
