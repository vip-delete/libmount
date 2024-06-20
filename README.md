# LibMount

[![ci](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml/badge.svg)](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

Standalone FAT12, FAT16, FAT32, VFAT implementation in JavaScript 

## Installation

`npm install libmount`

## API

```javascript
function mount(buf: ArrayBuffer, encoding: string = "cp1251"): FileSystem;
```

## Example

```javascript
import { mount } from "libmount";
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

## Commands

```npm run build``` - lint, compile, test and bundle javascript source files to ```dist/libmount.min.mjs```

```npm run dev``` - start local http server

