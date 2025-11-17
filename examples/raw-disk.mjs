import * as FS from "fs";
import { mount } from "../src/index.mjs";

// Root Access Required

const devicePath = "\\\\.\\PhysicalDrive1"; // Windows
// const devicePath = "/dev/sdb";           // Linux/macOS

const fd = FS.openSync(devicePath, "r");

const SZ = 512;

/**
 * @type {!Array<Uint8Array>}
 */
const sectors = [];

/**
 * @type {import("libmount").RandomAccessDriver}
 */
const driver = {
  capacity: 1000000000,
  read: (address, count) => {
    const sectorIndex = Math.floor(address / SZ);
    const sectorOffset = address % SZ;
    const sectorCount = Math.ceil((sectorOffset + count) / SZ);

    const buf = new Uint8Array(sectorCount * SZ);

    for (let i = sectorIndex; i < sectorIndex + sectorCount; i++) {
      let sector = sectors[i];
      if (!sector) {
        sector = new Uint8Array(SZ);
        const bytesRead = FS.readSync(fd, sector, 0, SZ, i * SZ);
        if (bytesRead !== SZ) {
          throw new Error(`Requested ${SZ}, but only ${bytesRead} read`);
        }
        sectors[i] = sector;
      }
      buf.set(sector, (sectorIndex - i) * SZ);
    }

    return buf.subarray(sectorOffset, sectorOffset + count);
  },
};

const disk = mount(driver);
const fs = disk.getFileSystem();

if (!fs) {
  throw new Error("FileSystem is not detected");
}

const sizeOfCluster = fs.getSizeOfCluster();
const countOfClusters = fs.getCountOfClusters();
const freeClusNum = fs.getFreeClusters();
const used = (countOfClusters - freeClusNum) * sizeOfCluster;
const free = freeClusNum * sizeOfCluster;

console.log(`
FileSystem Type: ${fs.getName()}
          Label: ${fs.getLabel()}
        OEMName: ${fs.getOEMName()}
   SerialNumber: 0x${fs.getId().toString(16).toUpperCase()}
  SizeOfCluster: ${sizeOfCluster}
CountOfClusters: ${countOfClusters}
   FreeClusters: ${freeClusNum}
     Used Space: ${used} bytes
     Free Space: ${free} bytes (${Math.round((freeClusNum * 100) / countOfClusters)}%)
`);

const root = fs.getRoot();

root.listFiles()?.forEach((it) => {
  console.log(it.getAbsolutePath());
});
