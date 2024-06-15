"use strict";

const FAT_DRIVER_EOF = 0;
const DIR_ENTRY_SIZE = 32;

class FATDriver {
  /**
   * @param {!BlockDevice} s
   * @param {!BootSector} bs
   * @param {!FATVariables} vars
   */
  constructor(s, bs, vars) {
    this.s = s;
    this.bs = bs;
    this.vars = vars;
  }

  /**
   * @returns {!FATNode}
   */
  getRoot() {
    return new FATNode(FAT_NODE.ROOT, "", null, 0, FAT_DRIVER_EOF, 0, FAT_DRIVER_EOF);
  }

  /**
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getNext(node) {
    return node.type === FAT_NODE.ROOT ? null : this.loadFromOffset(this.getNextOffset(node.offset + node.length));
  }

  /**
   * @param {!FATNode} node
   * @returns {?FATNode}
   */
  getFirst(node) {
    if (node.type === FAT_NODE.ROOT) {
      return this.loadFromOffset(this.bs.bpb.BytsPerSec * this.vars.FirstRootDirSecNum);
    }
    if (node.type != FAT_NODE.REGULAR_DIR) {
      return null;
    }
    if (node.contentOffset != FAT_DRIVER_EOF) {
      return this.loadFromOffset(node.contentOffset);
    }
    return null;
  }

  /**
   * @param {number} offset
   * @returns {?FATNode}
   */
  loadFromOffset(offset) {
    const chain = new FATChainLN();
    let currentOffset = -1;
    while (true) {
      if (offset === FAT_DRIVER_EOF) {
        return null;
      }
      if (offset != currentOffset) {
        //        if (offset % DIR_ENTRY_SIZE != 0) {
        //          throw "Offset " + offset + " is not " + DIR_ENTRY_SIZE + " bytes aligned"
        //        }
        this.s.pos = offset;
        currentOffset = offset;
      }
      const flag = this.s.readByte();
      this.s.pos--;
      if (flag === DIR_FLAG_LAST_ENTRY) {
        return null;
      }
      const node = this.visitOffset(chain, currentOffset, flag);
      if (node != null) {
        return node;
      }
      currentOffset += DIR_ENTRY_SIZE;
      offset = this.getNextOffset(currentOffset);
    }
  }

  /**
   * @param {!FATChainLN} chain
   * @param {number} currentOffset
   * @param {number} flag
   * @returns {?FATNode}
   */
  visitOffset(chain, currentOffset, flag) {
    this.s.pos += 11;
    const attr = this.s.readByte();
    this.s.pos -= 12;
    if (flag === DIR_FLAG_FREE_ENTRY) {
      if (attr === DIR_LN_ATTR_LONG_NAME) {
        chain.clear();
        return null;
      }
      const dir = DirEntry.load(this.s);
      return new FATNode(
        FAT_NODE.DELETED,
        NameUtil.getShortName(dir.Name),
        null,
        dir.FileSize,
        currentOffset,
        DIR_ENTRY_SIZE,
        this.getContentOffset(dir.FstClusLO),
      );
    }
    if (attr === DIR_LN_ATTR_LONG_NAME) {
      const dir = DirEntryLN.load(this.s);
      chain.addDirLN(dir);
      return null;
    }
    const dir = DirEntry.load(this.s);
    if ((attr & DIR_ATTR.VOLUME_ID) != 0) {
      return new FATNode(FAT_NODE.VOLUME_ID, NameUtil.getRawName(dir.Name), null, 0, currentOffset, DIR_ENTRY_SIZE, this.getContentOffset(dir.FstClusLO));
    }
    if (dir.Name[0] === ".".charCodeAt(0)) {
      const dotName = NameUtil.getRawName(dir.Name);
      if (dotName === ".") {
        return new FATNode(FAT_NODE.CURRENT_DIR, ".", null, 0, currentOffset, DIR_ENTRY_SIZE, this.getContentOffset(dir.FstClusLO));
      }
      if (dotName === "..") {
        return new FATNode(FAT_NODE.PARENT_DIR, "..", null, 0, currentOffset, DIR_ENTRY_SIZE, this.getContentOffset(dir.FstClusLO));
      }
      chain.clear();
      return null;
    }
    if (!NameUtil.isNameValid(dir.Name)) {
      chain.clear();
      return null;
    }
    chain.addDir(dir);
    const shortName = NameUtil.getShortName(dir.Name);
    const longName = chain.getLongName();
    if (shortName === "" || longName === "") {
      chain.clear();
      return null;
    }
    const type = (dir.Attr & DIR_ATTR.DIRECTORY) !== 0 ? FAT_NODE.REGULAR_DIR : FAT_NODE.REGULAR_FILE;
    const chainLength = chain.size() * DIR_ENTRY_SIZE;
    return new FATNode(
      type,
      shortName,
      longName,
      dir.FileSize,
      currentOffset - chainLength,
      chainLength + DIR_ENTRY_SIZE,
      this.getContentOffset(dir.FstClusLO),
    );
  }

  /**
   * @param {number} offset
   * @returns {number}
   */
  getNextOffset(offset) {
    if (offset % this.bs.bpb.BytsPerSec != 0) {
      return offset;
    }
    const secNum = Math.floor(offset / this.bs.bpb.BytsPerSec);
    if (secNum < this.vars.FirstDataSector) {
      return offset;
    }
    if (secNum === this.vars.FirstDataSector) {
      return FAT_DRIVER_EOF;
    }
    const dataSecNum = secNum - this.vars.FirstDataSector;
    if (dataSecNum % this.bs.bpb.SecPerClus != 0) {
      return offset;
    }
    const nexClusNum = this.getNextClusNum(1 + Math.floor(dataSecNum / this.bs.bpb.SecPerClus));
    return this.getContentOffset(nexClusNum);
  }

  /**
   * @param {number} nexClusNum
   * @returns {number}
   */
  getContentOffset(nexClusNum) {
    if (2 <= nexClusNum && nexClusNum <= this.vars.MAX) {
      return this.bs.bpb.BytsPerSec * this.getFirstSectorOfCluster(nexClusNum);
    }
    return FAT_DRIVER_EOF;
  }

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getFirstSectorOfCluster(clusNum) {
    return this.vars.FirstDataSector + (clusNum - 2) * this.bs.bpb.SecPerClus;
  }

  /**
   * @param {number} clusNum
   * @returns {number}
   */
  getNextClusNum(clusNum) {
    const fatOffset = clusNum + Math.floor(clusNum / 2);
    const thisFATSecNum = this.bs.bpb.RsvdSecCnt + fatOffset / this.bs.bpb.BytsPerSec;
    const thisFATEntOffset = fatOffset % this.bs.bpb.BytsPerSec;
    this.s.pos = thisFATSecNum * this.bs.bpb.BytsPerSec;
    this.s.pos += thisFATEntOffset;

    const fat12ClusEntryVal = this.s.readWord();
    return (clusNum & 1) === 1 ? fat12ClusEntryVal >> 4 : fat12ClusEntryVal & 0x0fff;
  }
}
