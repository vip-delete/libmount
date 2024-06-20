# LibMount

[![ci](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml/badge.svg)](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

Standalone FAT12, FAT16, FAT32, VFAT implementation in JavaScript 

## Installation

`npm install libmount`

## API

```javascript
function mount(buf: ArrayBuffer, encoding?: string): FileSystem | null;
```

[index.d.ts](types/index.d.ts)

## Example

```javascript
import { mount } from "libmount";
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
```

## Commands

```npm run build``` - lint, compile, test and bundle javascript source files to ```dist/libmount.min.mjs```

```npm run dev``` - start local http server

