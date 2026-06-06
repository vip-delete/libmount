import { compile, getExports, readFileSync, writeFileSync } from "./commons.mjs";

const exports = getExports("src/index.mjs");
writeFileSync("./dist/exports.mjs", `import { ${exports.join(", ")} } from "../src/index.mjs";\n${exports.map((it) => `libmount.${it} = ${it};\n`).join("")}`);

await compile(
  "lib-mount",
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

/**
 * @param {string} match
 * @param {string} name
 * @returns {string}
 */
const replacer = (match, name) => ("\n" + (name[0] === name[0].toUpperCase() ? "" : "export ") + "const " + name);

const filename = `dist/libmount.min.mjs`;
const ident = "(?<name>[A-Za-z_$][A-Za-z0-9_$]*)";
const regexp = "libmount\\." + ident;

const min = readFileSync(filename) //
  .replace(new RegExp("\\n" + regexp, "gu"), replacer)
  .replace(new RegExp(regexp, "gu"), replacer);

writeFileSync(filename, min);
