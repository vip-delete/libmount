"use strict";

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
}
