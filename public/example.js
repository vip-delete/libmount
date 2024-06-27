import { mount } from "../dist/libmount.min.mjs";
import { cp1251 } from "../dist/codec/cp1251.mjs";
import { readFileSync } from "fs";

const img = new Uint8Array(readFileSync("./images/freedos722.img", { flag: "r" }));
const disk = mount(img, cp1251);
const fs = disk.getFileSystem();

console.log(`FileSystem: ${fs.getName()}`);
console.log(`VolumeInfo: ${JSON.stringify(fs.getVolumeInfo())}`);

print(fs.getRoot());

function print(f) {
  console.log(f.getAbsolutePath());
  f.listFiles()?.forEach(print);
}
