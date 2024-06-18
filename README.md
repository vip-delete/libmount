# LibMount

[![ci](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml/badge.svg)](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

**FAT12**, **FAT16**, **FAT32** filesystem Javascript library for Browser and NodeJS

```javascript
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
```

API: [api.js](src/api.js)

Specification: [FAT.pdf](docs/FAT.pdf)

# Commands

```npm run build``` - lint, compile, test and bundle javascript source files to ```dist/libmount.min.mjs```

```npm run dev``` - start local http server

