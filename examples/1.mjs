import { readBinaryFileSync } from "../scripts/commons.mjs";
import { mount } from "../src/index.mjs";
// import { mount } from "libmount";

/**
 * @param {import("libmount").File} file
 */
const print = (file) => {
  console.log(file.getAbsolutePath());
  file.listFiles()?.forEach(print);
};

const img = readBinaryFileSync("./images/freedos722.img");
const disk = mount(img);
let fs = disk.getFileSystem();

if (!fs) {
  // check filesystem on 1st disk partition
  const partitions = disk.getPartitions();
  if (partitions.length) {
    const partition = partitions[0];
    console.log(`Found partition of type: ${partition.type}`);
    fs = mount(img, { partition }).getFileSystem();
  }
  if (!fs) {
    throw new Error("FileSystem is not detected");
  }
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

// file and dirs example manipulation
root.makeDir("/tmp");
root.makeFile("/test/foo.txt");
root.getFile("/test")?.moveTo("/tmp");

// file writing and reading example
const file = root.makeFile(".Hello[World]..txt");
if (file) {
  file.open()?.writeData(new TextEncoder().encode("😀😀😀"));
  const data = file.open()?.readData();
  if (data) {
    console.log(`
       FileSize: ${file.length()}
           Name: ${file.getName()}
      ShortName: ${file.getShortName()}
        Content: ${new TextDecoder().decode(data)}
   CreationTime: ${file.getCreationTime()?.toLocaleString()}
`);
  }
}

// list all files recursive:
print(root);
