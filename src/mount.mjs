import { Device } from "./types.mjs";
import { FATDriverImpl } from "./driver/driver.mjs";
import { FATFileSystem } from "./filesystem.mjs";
import { RawDevice } from "./io.mjs";
import { cp1252 } from "./codepages/cp1252.mjs";
import { loadPartitionTable } from "./loaders.mjs";

/**
 * @param {!Uint8Array} img
 * @param {!lm.MountOptions} [options]
 * @returns {!lm.Disk}
 */
export function mount(img, options) {
  const codepage = options?.codepage ?? cp1252;
  const parition = options?.partition ?? {
    active: false,
    type: 1,
    begin: 0,
    end: img.length,
  };
  return new DiskImpl(new RawDevice(img.subarray(parition.begin, parition.end)), codepage);
}

/**
 * @implements {lm.Disk}
 */
class DiskImpl {
  /**
   * @param {!Device} device
   * @param {!lm.Codepage} codepage
   */
  constructor(device, codepage) {
    this.device = device;
    this.codepage = codepage;
  }

  /**
   * @override
   * @returns {?lm.FileSystem}
   */
  getFileSystem() {
    if (!this.isSigValid()) {
      return null;
    }
    try {
      return new FATFileSystem(new FATDriverImpl(this.device, this.codepage));
    } catch {
      return null;
    }
  }

  /**
   * @override
   * @returns {!Array<!lm.Partition>}
   */
  getPartitions() {
    if (!this.isSigValid()) {
      return [];
    }
    this.device.seek(510 - 4 * 16);
    return loadPartitionTable(this.device).map((it) => ({
      active: it.BootIndicator === 0x80,
      type: it.SystemID,
      begin: it.RelativeSectors * 512,
      end: (it.RelativeSectors + it.TotalSectors) * 512,
    }));
  }

  /**
   * @returns {boolean}
   */
  isSigValid() {
    if (this.device.length() < 512) {
      return false;
    }

    this.device.seek(510);
    return this.device.readWord() === 0xaa55;
  }
}
