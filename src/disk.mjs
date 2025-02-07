import { createFileSystem } from "./fs.mjs";
import { loadPartitionTable } from "./dao.mjs";
import { createLogger } from "./log.mjs";
import { IO, Logger } from "./types.mjs";

/**
 * @type {!Logger}
 */
const log = createLogger("DISK");

/**
 * @implements {ns.Disk}
 */
class Disk {
  /**
   * @param {!IO} io
   * @param {!ns.Codepage} cp
   */
  constructor(io, cp) {
    this.io = io;
    this.cp = cp;
  }

  // ns.Disk

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  capacity() {
    return this.io.len();
  }

  /**
   * @override
   * @return {?ns.FileSystem}
   */
  // @ts-expect-error
  getFileSystem() {
    return createFileSystem(this.io, this.cp);
  }

  /**
   * @override
   * @return {!Array<!ns.Partition>}
   */
  // @ts-expect-error
  getPartitions() {
    /**
     * @type {!Array<!ns.Partition>}
     */
    let partitions = [];
    try {
      partitions = loadPartitionTable(this.io).map(({ BootIndicator, SystemID, RelativeSectors, TotalSectors }) => ({
        active: BootIndicator === 0x80,
        type: SystemID,
        relativeSectors: RelativeSectors,
        totalSectors: TotalSectors,
      }));
    } catch (/** @type {!*} */ e) {
      log.warn("No partition table", e);
    }
    return partitions;
  }

  /**
   * @override
   * @param {!ns.DiskSectors} diskSectors
   */
  // @ts-expect-error
  write(diskSectors) {
    const io = this.io;
    const { bytsPerSec, zeroRegions, dataSectors } = diskSectors;
    for (const { /** @type {number} */ i, /** @type {number} */ count } of zeroRegions) {
      io.seek(bytsPerSec * i).writeBytes(0, bytsPerSec * count);
    }
    for (const { /** @type {number} */ i, /** @type {!Uint8Array} */ data } of dataSectors) {
      io.seek(bytsPerSec * i).writeUint8Array(data);
    }
  }
}

// Export

/**
 * @param {!IO} io
 * @param {!ns.Codepage} cp
 * @return {!ns.Disk}
 */
export const createDisk = (io, cp) => new Disk(io, cp);
