import { readFileSync } from "fs";
import { mount } from "libmount";

const imgFilename = "../public/images/freedos722.img";
const imgFile = readFileSync(imgFilename, { flag: "r" });
const img = new Uint8Array(imgFile);
const disk = mount(img);
let fs = disk.getFileSystem();

if (fs === null) {
  // check filesystem on 1st disk partition
  const partitions = disk.getPartitions();
  if (partitions.length > 0) {
    const partition = partitions[0];
    console.log(`Found partition of type: ${partition.type}`);
    fs = mount(img, { partition }).getFileSystem();
  }
  if (fs === null) {
    console.error("FileSystem is not detected");
    process.exit(2);
  }
}

const v = fs.getVolume();
console.log(`FileSystem Type: ${fs.getName()}`);
console.log(`          Label: ${v.getLabel()}`);
console.log(`        OEMName: ${v.getOEMName()}`);
console.log(`   SerialNumber: 0x${v.getId().toString(16).toUpperCase()}`);
console.log(`  SizeOfCluster: ${v.getSizeOfCluster()}`);
console.log(`CountOfClusters: ${v.getCountOfClusters()}`);
console.log(`   FreeClusters: ${v.getFreeClusters()}`);
console.log(`     Used Space: ${fs.getRoot().getSizeOnDisk()}`);
console.log(`---`);

// file and dirs example manipulation
fs.getRoot().makeDir("/tmp");
fs.getRoot().makeFile("/test/foo.txt");
fs.getRoot().getFile("/test")?.moveTo("/tmp");

// file writing and reading example
const helloFile = fs.getRoot().makeFile(".Hello[World]..txt");
if (helloFile === null) {
  throw new Error("Can't create a file");
}
helloFile.setData(new TextEncoder().encode("😀😀😀"));
const data = helloFile.getData();
if (!data) {
  throw new Error("Impossible");
}
console.log(`    FileSize: ${helloFile.length()}`);
console.log(`        Name: ${helloFile.getName()}`);
console.log(`   ShortName: ${helloFile.getShortName()}`);
console.log(`     Content: ${new TextDecoder().decode(data)}`);
console.log("CreationTime: " + helloFile.creationTime()?.toLocaleString());

// list all files recursive example:
print(fs.getRoot());
function print(/** @type {import("libmount").File} */ f) {
  console.log(f.getAbsolutePath());
  f.listFiles()?.forEach(print);
}
