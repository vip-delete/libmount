"use strict";

/**
 * @implements {LibMount.FileSystem}
 */
class FATFileSystem {
  /**
   * @param {!FATDriver} driver
   */
  constructor(driver) {
    this.driver = driver;
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
    while (i < parts.length && node != null) {
      const name = parts[i];
      if (name !== "") {
        node = this.findFirstInDir(node, (it) => it.isRegular() && it.isMatch(name));
        if (node != null) {
          absolutePath += "/" + node.getName();
        }
      }
      i++;
    }
    return node == null ? null : new FATFile(absolutePath, node);
  }

  /**
   * @override
   * @param {!LibMount.File} file
   * @returns {!Array<!LibMount.File>}
   */
  listFiles(file) {
    const f = /** @type {!FATFile} */ (file);
    const parentPath = f.node.type === FAT_NODE.ROOT ? "" : f.absolutePath;
    return this.findAllInDir(f.node, (it) => it.isRegular()).map((node) => new FATFile(parentPath + "/" + node.getName(), node));
  }

  /**
   * @override
   * @param {!LibMount.File} file
   * @returns {?Uint8Array}
   */
  readFile(file) {
    const f = /** @type {!FATFile} */ (file);
    return this.driver.getContent(f.node);
  }

  /**
   * @param {!FATNode} dirNode
   * @param {function(!FATNode):boolean} predicate
   * @returns {?FATNode}
   */
  findFirstInDir(dirNode, predicate) {
    let node = this.driver.getFirst(dirNode);
    while (node != null) {
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
    let nodes = [];
    let node = this.driver.getFirst(dirNode);
    while (node != null) {
      if (predicate(node)) {
        nodes.push(node);
      }
      node = this.driver.getNext(node);
    }
    return nodes;
  }
}
