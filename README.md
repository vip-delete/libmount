# LibMount

[![ci](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml/badge.svg)](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

Standalone FAT12, FAT16, FAT32, VFAT implementation in JavaScript 

## Installation

`npm install libmount`

## API

```javascript
function mount(img: Uint8Array, codec: Codec): LmDisk;
```

[index.d.ts](types/index.d.ts)

## Example

```javascript
import { mount } from "libmount";
import { readFileSync } from "fs";
import { cp1251 } from "libmount/codecs/cp1251";

const file = readFileSync("./freedos722.img", { flag: "r" });
const disk = mount(new Uint8Array(file), cp1251);
const fs = disk.getFileSystem();

if (fs === null) {
    console.error("FileSystem is not detected");
    process.exit(2);
}
fs.mkfile('/test/bar.txt').getAbsolutePath();
print(fs.getRoot());

console.log(`FileSystem: ${fs.getName()}`);
console.log(`VolumeInfo: ${JSON.stringify(fs.getVolumeInfo())}`);

function print(f) {
  console.log(f.getAbsolutePath());
  f.listFiles()?.forEach(print);
}
```

## Commands

```npm run build``` - lint, compile, test and bundle javascript source files to ```dist/libmount.min.mjs```

```npm run dev``` - start local http server

