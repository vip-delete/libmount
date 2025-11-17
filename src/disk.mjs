import { SZ } from "./const.mjs";
import { loadPartitionTable } from "./dao.mjs";
import { createFileSystem } from "./fs.mjs";
import { createIO } from "./io.mjs";
import { Driver } from "./types.mjs";

/**
 * @implements {ns.Disk}
 */
class Disk {
  /**
   * @param {!Driver} driver
   * @param {!ns.Codepage} cp
   */
  constructor(driver, cp) {
    this.driver = driver;
    this.cp = cp;
  }

  // ns.Disk

  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  capacity() {
    return this.driver.len();
  }

  /**
   * @override
   * @return {?ns.FileSystem}
   */
  // @ts-expect-error
  getFileSystem() {
    return createFileSystem(this.driver, this.cp);
  }

  /**
   * @override
   * @return {!Array<!ns.Partition>}
   */
  // @ts-expect-error
  getPartitions() {
    if (this.driver.len() < SZ) {
      return [];
    }
    const array = this.driver.readUint8Array(0, SZ);
    const io = createIO(array);
    try {
      return loadPartitionTable(io).map(({ BootIndicator, SystemID, RelativeSectors, TotalSectors }) => ({
        active: BootIndicator === 0x80,
        type: SystemID,
        relativeSectors: RelativeSectors,
        totalSectors: TotalSectors,
      }));
      // @ts-expect-error
    } catch (/** @type {!Error} */ e) {
      if (e.name === "ValidationError") {
        // console.warn("No partition table", e);
        return [];
      }
      throw e;
    }
  }

  /**
   * @override
   * @param {!ns.DiskSectors} diskSectors
   */
  // @ts-expect-error
  write(diskSectors) {
    const { driver } = this;
    const { bytsPerSec, zeroRegions, dataSectors } = diskSectors;
    for (const { /** @type {number} */ i, /** @type {number} */ count } of zeroRegions) {
      driver.writeBytes(bytsPerSec * i, 0, bytsPerSec * count);
    }
    for (const { /** @type {number} */ i, /** @type {!Uint8Array} */ data } of dataSectors) {
      driver.writeUint8Array(bytsPerSec * i, data);
    }
  }
}

// Export

/**
 * @param {!Driver} driver
 * @param {!ns.Codepage} cp
 * @return {!ns.Disk}
 */
export const createDisk = (driver, cp) => new Disk(driver, cp);
