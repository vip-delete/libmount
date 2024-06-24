import { mount } from "../dist/libmount.min.mjs";
import { readFileSync } from "fs";

const file = readFileSync("./images/freedos722.img", { flag: "r" });
const fs = mount(file.buffer);
if (!fs) {
  console.error("FileSystem is not detected");
  process.exit(1);
}
console.log(`FileSystem: ${fs.getName()}`);
console.log(`VolumeInfo: ${JSON.stringify(fs.getVolumeInfo())}`);
print(fs.getRoot());

function print(f) {
  console.log(f.getAbsolutePath());
  f.listFiles()?.forEach(print);
}
