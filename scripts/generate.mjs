import { buildSync } from "esbuild";
import { BS_BOOT_CODE_FAT32_LENGTH, BS_BOOT_CODE_LENGTH } from "../src/const.mjs";
import { getBanner, mkdirSync, nasm, readBinaryFileSync, readFileSync, writeFileSync } from "./commons.mjs";

// set true to regenerate src/bs.mjs from src/bs.asm
const GENERATE_BOOT_SECTOR = false;

/**
 * @type {!Array<!Array<string>>}
 */
const STRING_ESCAPE_MAPPINGS = [
  ["\\", "\\\\"],
  ["\x22", "\\\x22"], // QUOTATION MARK
  ["\t", "\\t"],
  ["\n", "\\n"],
  ["\v", "\\v"], // 0x0B Vertical Tab
  ["\f", "\\f"], // 0x0C Form Feed
  ["\r", "\\r"],
  ["\xA0", "\\xA0"], // NBSP
  ["\x00", "\\x00"], // NULL
  ["\x7F", "\\x7F"], // DELETE
];

/**
 * @param {string} str
 * @returns {string}
 */
const escape = (str) => {
  for (let i = 0; i < STRING_ESCAPE_MAPPINGS.length; i++) {
    const row = STRING_ESCAPE_MAPPINGS[i];
    str = str.replaceAll(row[0], row[1]);
  }
  return str;
};

const generateBootSector = async () => {
  mkdirSync("temp");
  const asm = "src/bs.asm";
  const mjs = "src/bs.mjs";

  const offset12 = 510 - BS_BOOT_CODE_LENGTH; // 0x3E: 62
  const offset32 = 510 - BS_BOOT_CODE_FAT32_LENGTH; // 0x5A: 90

  await nasm("BootSector-FAT12/16", asm, "temp/bs12.bin", [`-DBootOffset=${offset12}`]);
  await nasm("BootSector-FAT32", asm, "temp/bs32.bin", [`-DBootOffset=${offset32}`]);

  const bs12 = readBinaryFileSync("temp/bs12.bin");
  const bs32 = readBinaryFileSync("temp/bs32.bin");

  const bytes12 = [...bs12]; // 512 bytes
  const bytes32 = [...bs32]; // 512 bytes

  // latin1 encoding
  const bootCode12 = escape(String.fromCharCode(...bytes12.slice(offset12, bytes12.indexOf(0, offset12))));
  const bootCode32 = escape(String.fromCharCode(...bytes32.slice(offset32, bytes32.indexOf(0, offset32))));

  writeFileSync(
    mjs,
    `// Code generated from bs.asm: DO NOT EDIT.
import { str2bytes } from "./utils.mjs";

export const jmpBoot12 = [0x${bs12[0].toString(16)}, 0x${bs12[1].toString(16)}, 0x${bs12[2].toString(16)}];
export const jmpBoot32 = [0x${bs32[0].toString(16)}, 0x${bs32[1].toString(16)}, 0x${bs32[2].toString(16)}];
/**
 * @type {!Uint8Array}
 */
export const BootCode12 = str2bytes("${bootCode12}");
/**
 * @type {!Uint8Array}
 */
export const BootCode32 = str2bytes("${bootCode32}");
`,
  );

  console.log(`\x1b[33mbs.mjs\x1b[0m: \x1b[92mGENERATED\x1b[0m: ${mjs}\n`);
};

const generateBundle = () => {
  // update README.md
  const readme = readFileSync("README.md");
  const updated = readme.replace(/```javascript\n\/\/ (?<filename>.+?)\n[\s\S]*?\n```/gu, (match, ...args) => {
    const { filename } = args.at(-1);
    try {
      const content = readFileSync(filename);
      return `\`\`\`javascript\n// ${filename}\n${content.trim()}\n\`\`\``;
    } catch (e) {
      console.error(e);
      return match;
    }
  });
  writeFileSync("README.md", updated);

  // generate *.d.mts
  const mts = [];
  const lines = readFileSync("src/global.d.ts").split(/\r\n|\n/u);
  for (const line of lines) {
    if (line.length === 0) {
      mts.push(line);
    } else if (line.startsWith("  ")) {
      mts.push(line.slice(2));
    }
  }
  const mtsContent = mts.join("\n") + "\n";
  writeFileSync("dist/libmount.d.mts", mtsContent);

  // esbuild
  const banner = getBanner();
  buildSync({
    entryPoints: ["./src/index.mjs"],
    banner: { js: banner },
    format: "esm",
    bundle: true,
    charset: "utf8",
    outfile: "./dist/libmount.mjs",
  });
};

// main
mkdirSync("dist");

// generate src/bs.mjs
if (GENERATE_BOOT_SECTOR) {
  await generateBootSector();
}

generateBundle();
