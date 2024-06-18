import { mount } from "../dist/libmount.min.mjs";
import { readFileSync } from "fs";

const file = readFileSync("./freedos722.img", { flag: "r" });
const fs = mount(file.buffer);
const root = fs.getRoot();
const files = fs.listFiles(root);
print(0, fs, files);

function print(indent, fs, files) {
  files.forEach((it) => {
    console.log(" ".repeat(indent) + it.getName());
    if (it.isDirectory()) {
      print(indent + 2, fs, fs.listFiles(it));
    }
  });
}
