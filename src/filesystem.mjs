import { FATNode, FATNodeType, FileSystemDriver } from "./types.mjs";
import { parseDate, parseDateTime } from "./util.mjs";

/**
 * @implements {lm.FileSystem}
 */
export class FATFileSystem {
  /**
   * @param {!FileSystemDriver<!FATNode>} driver
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
    return this.node.Name;
  }

  /**
   * @override
   * @returns {string}
   */
  getShortName() {
    return this.node.ShortName;
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
    return this.node.Type === FATNodeType.REGULAR_FILE;
  }

  /**
   * @override
   * @returns {boolean}
   */
  isDirectory() {
    return this.node.Type === FATNodeType.REGULAR_DIR || this.node.Type === FATNodeType.ROOT;
  }

  /**
   * @override
   * @returns {number}
   */
  length() {
    return this.node.DirEntry?.FileSize;
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @returns {!Date}
   */
  lastModified() {
    const dirEntry = this.node.DirEntry;
    return new Date(parseDateTime(dirEntry.WrtDate, dirEntry.WrtTime, 0));
  }

  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @returns {!Date}
   */
  creationTime() {
    const dirEntry = this.node.DirEntry;
    return new Date(parseDateTime(dirEntry.CrtDate, dirEntry.CrtTime, dirEntry.CrtTimeTenth));
  }

  /**
   * yyyy.MM.dd
   * @override
   * @returns {!Date}
   */
  lastAccessTime() {
    const dirEntry = this.node.DirEntry;
    return new Date(parseDate(dirEntry.LstAccDate));
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
    const parentPath = this.node.Type === FATNodeType.ROOT ? "" : this.absolutePath;
    let node = this.fs.driver.getFirst(this.node);
    while (node !== null) {
      if (node.Type === FATNodeType.REGULAR_DIR || node.Type === FATNodeType.REGULAR_FILE) {
        const file = new FATFile(this.fs, parentPath + "/" + node.Name, node);
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
    return upperCaseName === this.node.Name.toUpperCase() || upperCaseName === this.node.ShortName.toUpperCase();
  }
}
