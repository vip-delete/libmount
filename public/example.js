import { mount } from "../dist/libmount.min.mjs";
import { readFileSync } from "fs";

const file = readFileSync("./images/freedos722.img", { flag: "r" });
const fs = mount(file.buffer);
print(0, fs.getRoot());

function print(indent, file) {
  console.log(" ".repeat(indent) + file.getName());
  if (file.isDirectory()) {
    fs.listFiles(file).forEach((f) => print(indent + 2, f));
  }
}
