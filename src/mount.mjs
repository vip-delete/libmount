import { SZ } from "./const.mjs";
import { createDisk } from "./disk.mjs";
import { createDriver } from "./io.mjs";
import { latin1 } from "./latin1.mjs";

/**
 * @param {!Uint8Array} img
 * @return {!ns.RandomAccessDriver}
 */
const createUint8ArrayDriver = (img) => ({
  capacity: img.length,

  /**
   * @param {number} address
   * @param {number} count
   * @return {!Uint8Array}
   */
  read: (address, count) => img.slice(address, address + count),

  /**
   * @param {number} address
   * @param {!Uint8Array} data
   * @return {void}
   */
  write: (address, data) => img.set(data, address),
});

/**
 * @param {!ns.Partition} partition
 * @param {!ns.RandomAccessDriver} driver
 * @return {!ns.RandomAccessDriver}
 */
const createPartitionDriver = (partition, driver) => {
  const begin = partition.relativeSectors * SZ;
  const { read, write } = driver;

  /**
   * @type {!ns.RandomAccessDriver}
   */
  const partitionDriver = {
    capacity: partition.totalSectors * SZ,

    /**
     * @param {number} address
     * @param {number} count
     * @return {!Uint8Array}
     */
    read: (address, count) => read(begin + address, count),
  };

  if (write) {
    /**
     * @param {number} address
     * @param {!Uint8Array} data
     * @return {void}
     */
    partitionDriver.write = (address, data) => write(begin + address, data);
  }

  return partitionDriver;
};

/**
 * @param {!Uint8Array|!ns.RandomAccessDriver} driver
 * @param {!ns.MountOptions} [options]
 * @return {!ns.Disk}
 */
export const mount = (driver, options) => {
  if (driver instanceof Uint8Array) {
    driver = createUint8ArrayDriver(driver);
  }

  const partition = options?.partition;
  if (partition) {
    driver = createPartitionDriver(partition, driver);
  }

  const driverIO = createDriver(driver);
  return createDisk(driverIO, options?.codepage ?? latin1);
};
