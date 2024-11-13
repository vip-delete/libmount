# LibMount

[![ci](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml/badge.svg)](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

Standalone FAT12, FAT16, FAT32, VFAT implementation in JavaScript

## Installation

`npm install libmount`

## API

```javascript
function mount(img: Uint8Array, codepage?: Codepage = cp1252): Disk;
```

See more in [libmount.d.mts](types/libmount.d.mts)

## Overview

🐕 The **libmount** is an attempt to implement the FAT specification from scratch (FAT12, FAT16, FAT32) in pure JavaScript just for fun and because there is no such library except the outdated [fatfs](https://github.com/natevw/fatfs). The **libmount** is a project that is supposed to have all cutting-edge JavaScript dev-tools: Stylistic, Vitest, ESLint, Prettier, and, most importantly, Closure Compiler (CC). I know CC is out of support, but it does the job much better than TypeScript + any minifier. Let me know if you disagree or find any replacement for CC!

🏆 The **libmount** supports almost everything from the FAT specification: long filenames (LFNs), OEM charsets (codepages), and file manipulations such as listing, creating, renaming, moving, reading, writing, and deleting files. In addition, the library supports partitioned disk images and provides type definitions for TypeScript.

💡 The FAT specification requires an OEM charset to encode and decode short filenames (SFNs), also known as 8.3 names. SFNs can include uppercase letters, digits, characters with code point values greater than 127, and certain special characters. Code points above 127 are used for national symbols, such as Cyrillic (CP1251), Japanese (Shift JIS), Arabic (ISO 8859-6), and others. If the FAT image contains SFNs with code points above 127, it is very important to provide the correct codepage. By default, libmount uses **cp1252**, the default encoding for Latin-based languages in Windows.

🌟 The long filenames (LFNs) are designed to bypass 8.3 SFNs and OEM charset limitations. LFNs always use 16 bits per character (UTF-16) instead of 8 bits for SFNs. LFNs also support Unicode surrogate pairs. For example, the filename '😀' consists of two UTF-16 code units and is encoded in 4 bytes [3D, D8, 00, DE]. By the way, JavaScript also uses UTF-16, which makes translation from JavaScript strings to LFN bytes easy. The funny thing is that `'😀'.length` returns `2` for just one visible character. Please give a star to this project if you are surprised.

## Example

```javascript
import { mount } from "libmount";
import { readFileSync } from "fs";
import { cp1251 as cp } from "libmount/codepages";

const file = readFileSync("./freedos722.img", { flag: "r" });
const rawImage = new Uint8Array(file);
const disk = mount(rawImage, cp);
let fs = disk.getFileSystem();

if (fs === null) {
    // probably the disk is partitioned
    const partitions = disk.getPartitions();
    console.log(`Found ${partitions.length} partitions`);
    for (let i = 0; i < partitions.length; i++) {
      console.log(`Try to mount partition #${i} of type ${partitions[i].type}`);
      const rawPartition = rawImage.subarray(partitions[i].begin, partitions[i].end);
      const partition = mount(rawPartition, cp);
      fs = partition.getFileSystem();
    }
    if (fs === null) {
        console.error("FileSystem is not detected");
        process.exit(2);
    }
}
fs.makeFile('/tmp', true);           // create /tmp directory
fs.makeFile('/test/foo.txt', false); // create /test directory and foo.txt file
fs.moveFile('/test', '/tmp');        // move /text directory to /tmp

print(fs.getRoot());

console.log(`FileSystem: ${fs.getName()}`);
console.log(`VolumeInfo: ${JSON.stringify(fs.getVolumeInfo())}`);

function print(f) {
  console.log(f.getAbsolutePath());
  f.listFiles()?.forEach(print);
}
```

## Commands

```npm run build``` - lint, compile, test and bundle JavaScript files to ```dist/libmount.min.mjs```

```npm run dev``` - start local http server

