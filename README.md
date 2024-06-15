# LibMount

[![ci](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml/badge.svg)](https://github.com/vip-delete/libmount/actions/workflows/ci.yaml)

**FAT12**, **FAT16**, **FAT32** filesystem Javascript library for Browser and NodeJS

```javascript
import { readFileSync } from "fs";
import LibMount from "libmount.min.mjs";

const file = readFileSync("freedos722.img", { flag: "r" });
const fs = LibMount.mount(file.buffer);
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

API: [api.js](src/main/javascript/libmount/api.js)

Specification: [FAT.pdf](docs/FAT.pdf)

Start locally: ```npm run dev```

# Commands

```npm run build``` - compile javascript source files and create ```dist/libmount.min.mjs```

```npm run dev``` - start local http server and serve ```debug.html``` with uncompiled javascript source code

```npm test``` - run tests
