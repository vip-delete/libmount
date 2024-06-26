# LibMount

[![ci](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml/badge.svg)](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

Standalone FAT12, FAT16, FAT32, VFAT implementation in JavaScript 

## Installation

`npm install libmount`

## API

```javascript
function mount(img: Uint8Array, charmap?: string): LmDisk;
```

[index.d.ts](types/index.d.ts)

## Example

```javascript
import { mount } from "libmount";
import { readFileSync } from "fs";

const file = readFileSync("./freedos722.img", { flag: "r" });
const disk = mount(new Uint8Array(file));
const fs = disk.getFileSystem();

print(fs.getRoot());

function print(f) {
  console.log(f.getAbsolutePath());
  f.listFiles()?.forEach(print);
}
```

## Commands

```npm run build``` - lint, compile, test and bundle javascript source files to ```dist/libmount.min.mjs```

```npm run dev``` - start local http server

