import { Device } from "./types.mjs";
import { FATDriver } from "./driver.mjs";
import { FATFileSystem } from "./filesystem.mjs";
import { RawDevice } from "./io.mjs";
import { cp1252 } from "./charmap.mjs";
import { loadPartitionTable } from "./loaders.mjs";

/**
 * @param {!Uint8Array} img
 * @param {string} [charmap]
 * @returns {!lm.Disk}
 */
export function mount(img, charmap) {
  return new LmDisk(new RawDevice(img), charmap && charmap.length === cp1252.length ? charmap : cp1252);
}

/**
 * @implements {lm.Disk}
 */
class LmDisk {
  /**
   * @param {!Device} device
   * @param {string} charmap
   */
  constructor(device, charmap) {
    this.device = device;
    this.charmap = charmap;
  }

  /**
   * @override
   * @returns {?lm.FileSystem}
   */
  getFileSystem() {
    if (!isSigValid(this.device)) {
      return null;
    }
    try {
      return new FATFileSystem(new FATDriver(this.device, this.charmap));
    } catch {
      return null;
    }
  }

  /**
   * @override
   * @returns {!Array<!lm.Partition>}
   */
  getPartitions() {
    if (!isSigValid(this.device)) {
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
}

/**
 * @param {!Device} device
 * @returns {boolean}
 */
function isSigValid(device) {
  if (device.length() < 512) {
    return false;
  }

  device.seek(510);
  return device.readWord() === 0xaa55;
}
