import { FATDriverImpl } from "./driver.mjs";
import { FATFileSystem } from "./fs.mjs";
import { RawDevice } from "./io.mjs";
import { LATIN1 } from "./latin1.mjs";
import { loadPartitionTable } from "./loaders.mjs";
import { Device } from "./types.mjs";

/**
 * @param {!Uint8Array} img
 * @param {!lmNS.MountOptions} [options]
 * @returns {!lmNS.Disk}
 */
export function mount(img, options) {
  const encoding = options?.encoding ?? LATIN1;
  const parition = options?.partition ?? {
    active: false,
    type: 1,
    begin: 0,
    end: img.length,
  };
  return new DiskImpl(new RawDevice(img.subarray(parition.begin, parition.end)), encoding);
}

/**
 * @implements {lmNS.Disk}
 */
class DiskImpl {
  /**
   * @param {!Device} device
   * @param {!lmNS.Encoding} encoding
   */
  constructor(device, encoding) {
    this.device = device;
    this.encoding = encoding;
  }

  /**
   * @override
   * @returns {?lmNS.FileSystem}
   */
  // @ts-ignore
  getFileSystem() {
    if (!this.isSigValid()) {
      return null;
    }
    try {
      return new FATFileSystem(new FATDriverImpl(this.device, this.encoding));
    } catch {
      return null;
    }
  }

  /**
   * @override
   * @returns {!Array<!lmNS.Partition>}
   */
  // @ts-ignore
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
