import { FATDriver, FATNode } from "./model.mjs";
import { parseDate, parseDateTime } from "./util.mjs";

/**
 * @implements {lm.FileSystem}
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
   * @param {string} path
   * @returns {?FATFile}
   */
  getFile(path) {
    const parts = path.split(/[/\\]/u);
    let file = this.getRoot();
    let i = 0;
    while (i < parts.length && file !== null) {
      const name = parts[i];
      if (name !== "") {
        file = file.findFirst((f) => f.match(name));
      }
      i++;
    }
    return file;
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
    this.fs = fs;
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
    return this.node.isRegularFile();
  }

  /**
   * @override
   * @returns {boolean}
   */
  isDirectory() {
    return this.node.isRegularDirectory() || this.node.isRoot();
  }

  /**
   * @override
   * @returns {number}
   */
  length() {
    return this.node.getFileSize();
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @returns {!Date}
   */
  lastModified() {
    const dirEntry = this.node.dirEntry;
    return new Date(dirEntry === null ? 0 : parseDateTime(dirEntry.WrtDate, dirEntry.WrtTime, 0));
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @returns {!Date}
   */
  creationTime() {
    const dirEntry = this.node.dirEntry;
    return new Date(dirEntry === null ? 0 : parseDateTime(dirEntry.CrtDate, dirEntry.CrtTime, dirEntry.CrtTimeTenth));
  }

  /**
   * yyyy.MM.dd
   * @override
   * @returns {!Date}
   */
  lastAccessTime() {
    const dirEntry = this.node.dirEntry;
    return new Date(dirEntry === null ? 0 : parseDate(dirEntry.LstAccDate));
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
    const parentPath = this.node.isRoot() ? "" : this.absolutePath;
    let node = this.fs.driver.getFirst(this.node);
    while (node !== null) {
      if (node.isRegular()) {
        const file = new FATFile(this.fs, parentPath + "/" + node.getName(), node);
        if (predicate(file)) {
          return file;
        }
      }
      node = this.fs.driver.getNext(node);
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
   * @param {string} name
   * @returns {boolean}
   */
  match(name) {
    const upperCaseName = name.toUpperCase();
    return upperCaseName === this.node.shortName.toUpperCase() || upperCaseName === this.node.longName?.toUpperCase();
  }
}
