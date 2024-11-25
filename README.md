# LibMount

[![ci](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml/badge.svg)](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

Standalone FAT12, FAT16, FAT32, VFAT implementation in JavaScript

## Installation

`npm install libmount`

## API

```javascript
function mount(img: Uint8Array, options?: MountOptions): Disk;
```

See more details in [libmount.d.mts](types/libmount.d.mts)

## Overview

🐕 The **libmount** is an attempt to implement the FAT specification from scratch (FAT12, FAT16, FAT32) in pure JavaScript just for fun and because there is no such library except the outdated [fatfs](https://github.com/natevw/fatfs). The **libmount** is a project that is supposed to have all cutting-edge JavaScript dev-tools: Stylistic, Vitest, ESLint, Prettier, and, most importantly, Closure Compiler (CC). I know CC is out of support, but it does the job much better than TypeScript + any minifier. Let me know if you disagree or find any replacement for CC!

🏆 The **libmount** supports almost everything from the FAT specification: long filenames (LFNs), OEM charsets (codepages), and file manipulations such as listing, creating, renaming, moving, reading, writing, and deleting files. In addition, the library supports partitioned disk images and provides type definitions for TypeScript.

💡 The FAT specification requires an OEM charset to encode and decode short filenames (SFNs), also known as 8.3 names. SFNs can include uppercase letters, digits, characters with code point values greater than 127, and certain special characters. Code points above 127 are used for national symbols, such as Cyrillic (CP1251), Japanese (Shift JIS), Arabic (ISO 8859-6), and others. If the FAT image contains SFNs with code points above 127, it is crucial to specify the correct codepage to decode the filenames accurately, rather than seeing garbled text like ïðèâåò. By default, libmount uses **cp1252**, the default encoding for Latin-based languages in Windows.

🌟 The long filenames (LFNs) are designed to bypass 8.3 SFNs and OEM charset limitations. LFNs always use 16 bits per character (UTF-16) instead of 8 bits for SFNs. LFNs also support Unicode surrogate pairs. For example, the filename '😀' consists of two UTF-16 code units and is encoded in 4 bytes [3D, D8, 00, DE]. By the way, JavaScript also uses UTF-16, which makes translation from JavaScript strings to LFN bytes easy. The funny thing is that `'😀'.length` returns `2` for just one visible character. Please give a star to this project if you are surprised.

## Example

```javascript
import { mount } from "libmount";
import { readFileSync } from "fs";
import { cp1251 as codepage } from "libmount/codepages";

const imgFilename = "./images/freedos722.img"
const imgFile = readFileSync(imgFilename, { flag: "r" });
const img = new Uint8Array(imgFile);
const disk = mount(img, { codepage });
let fs = disk.getFileSystem();

if (fs === null) {
  // check filesystem on 1st disk partition
  const partitions = disk.getPartitions();
  if (partitions.length > 0) {
    const partition = partitions[0];
    console.log(`Found partition of type: ${partition.type}`);
    fs = mount(img, { codepage, partition }).getFileSystem();
  }
  if (fs === null) {
    console.error("FileSystem is not detected");
    process.exit(2);
  }
}

const v = fs.getVolume();
console.log(`FileSystem Type: ${fs.getName()}`);
console.log(`          Label: ${v.getLabel()}`);
console.log(`        OEMName: ${v.getOEMName()}`);
console.log(`   SerialNumber: 0x${v.getId().toString(16).toUpperCase()}`);
console.log(`  SizeOfCluster: ${v.getSizeOfCluster()}`);
console.log(`CountOfClusters: ${v.getCountOfClusters()}`);
console.log(`   FreeClusters: ${v.getFreeClusters()}`);
console.log(`     Used Space: ${fs.getRoot().getSizeOnDisk()}`);
console.log(`---`);

// file and dirs example manipulation
fs.getRoot().makeDir("/tmp");
fs.getRoot().makeFile("/test/foo.txt");
fs.getRoot().getFile("/test")?.moveTo("/tmp");

// file writing and reading example
const helloFile = fs.getRoot().makeFile(".Hello[World]..txt");
if (helloFile === null) {
  console.error("Can't create a file");
  process.exit(2);
}
helloFile.setData(new TextEncoder().encode("😀😀😀"));
const content = new TextDecoder().decode(helloFile.getData());
console.log(`    FileSize: ${helloFile.length()}`)
console.log(`        Name: ${helloFile.getName()}`)
console.log(`   ShortName: ${helloFile.getShortName()}`)
console.log(`     Content: ${content}`)
console.log("CreationTime: " + helloFile.creationTime()?.toLocaleString());

// list all files recursive example:
print(fs.getRoot());
function print(f) {
  console.log(f.getAbsolutePath());
  f.listFiles()?.forEach(print);
}
```

## Output
```
FileSystem Type: FAT12
          Label: FREEDOS
        OEMName: FreeDOS
   SerialNumber: 0xE4C95CE8
  SizeOfCluster: 1024
CountOfClusters: 713
   FreeClusters: 45
     Used Space: 684032
---
    FileSize: 12
        Name: .Hello[World]..txt
   ShortName: _HELLO~1.TXT
     Content: 😀😀😀
CreationTime: 12/2/2024, 12:15:16 AM
/
/KERNEL.SYS
/COMMAND.COM
/AUTOEXEC.BAT
...
/tmp
/tmp/test
/tmp/test/foo.txt
/.Hello[World]..txt
```

## Commands

```npm run build``` - lint, compile, test and bundle JavaScript files to ```dist/libmount.min.mjs```

```npm run dev``` - start local http server

