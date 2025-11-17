import { compile, getExports, writeFileSync } from "./commons.mjs";

const exports = getExports("src/index.mjs");

writeFileSync("./dist/exports.mjs", `import { ${exports.join(", ")} } from "../src/index.mjs";\n${exports.map((it) => `ns.${it} = ${it};\n`).join("")}`);
const outputWrapper = `const ns = {};\n%output%\nexport const { ${exports.join(", ")} } = ns;\n`;

await compile(
  "lib-mount",
  outputWrapper,
  `dist/libmount.min.mjs`,
  [
    "src/externs.mjs",
    "src/defines.mjs",
    // "src/log.mjs",
    "src/latin1.mjs",
    "src/bs.mjs",
    //
    "src/types.mjs",
    "src/const.mjs",
    "src/utils.mjs",
    "src/io.mjs",
    //
    "src/dao.mjs",
    "src/fs.mjs",
    "src/disk.mjs",
    //
    "src/mount.mjs",
    "src/fdisk.mjs",
    "src/mkfsvfat.mjs",
    //
    "src/index.mjs",
    "dist/exports.mjs",
  ],
  [
    //
    "USE_LOG=false",
    "USE_ASSERTS=false",
    "USE_LFN=true",
  ],
);
