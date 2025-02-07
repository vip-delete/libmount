import { spawn } from "child_process";
import fs from "fs";
import { compiler as Compiler } from "google-closure-compiler";
import Path from "path";
import { fileURLToPath } from "url";
import pkg from "../package.json" with { type: "json" };

export const getBanner = () =>
  `/**
 * iconv-tiny v${pkg.version}
 * (c) 2025-present ${pkg.author}
 * @license ${pkg.license}
 **/
`;

/**
 * @param {string} rel
 * @returns {string}
 */
export const abs = (rel) => Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), "../" + rel);

/**
 * @param {string} filename
 * @returns {!Uint8Array}
 */
export const readBinaryFileSync = (filename) => new Uint8Array(fs.readFileSync(abs(filename), { flag: "r" }));

/**
 * @param {string} filename
 * @returns {string}
 */
export const readFileSync = (filename) => fs.readFileSync(abs(filename), "utf-8");

/**
 * @param {string} path
 * @returns {!string}
 */
export const getExports = (path) => {
  const exports = readFileSync(path)
    .split("\n")
    .filter((it) => it.startsWith("export"))
    .flatMap((it) => {
      const i = it.indexOf("{");
      const j = it.indexOf("}", i + 1);
      if (i !== -1 && j !== -1) {
        return it
          .slice(i + 1, j)
          .split(",")
          .map((item) => item.trim());
      }
      return [];
    });

  return "{" + exports.join(",") + "}";
};

/**
 * @param {string} path
 * @returns {boolean}
 */
export const existsSync = (path) => fs.existsSync(abs(path));

/**
 * @param {string} dir
 * @returns {undefined}
 */
export const mkdirSync = (dir) => {
  if (!fs.existsSync(abs(dir))) {
    console.log(`MKDIR:  ${dir}`);
    fs.mkdirSync(abs(dir), { recursive: true });
  }
};

/**
 * @param {string} filename
 * @param {string|Uint8Array} content
 * @returns {undefined}
 */
export const writeFileSync = (filename, content) => {
  console.log(`WRITE:  ${filename}`);
  fs.writeFileSync(abs(filename), content);
};

/**
 * @param {string} name
 * @param {string} outputWrapper
 * @param {string} outputFile
 * @param {!Array<string>} files
 * @param {!Array<string>} defines
 */
export const compile = async (name, outputWrapper, outputFile, files, defines) => {
  const args = {
    /* eslint-disable camelcase */
    module_resolution: "BROWSER",
    compilation_level: "ADVANCED",
    warning_level: "VERBOSE",
    jscomp_error: "*",
    jscomp_warning: "reportUnknownTypes",
    assume_function_wrapper: true,
    output_wrapper: outputWrapper,
    summary_detail_level: String(3),
    use_types_for_optimization: true,
    define: defines,
    js_output_file: abs(outputFile),
    charset: "utf-8",
    js: files.map(abs),
    /* eslint-enable camelcase */
  };

  await new Promise((resolve, reject) => {
    new Compiler(args).run((exitCode, stdout, stderr) => {
      if (stdout) {
        console.log(stdout);
      }

      if (stderr) {
        console.log(stderr);
      }

      if (exitCode === 0 && !stderr.includes("100.0%")) {
        reject(new Error("Need 100% type coverage"));
      }

      if (exitCode === 0) {
        resolve(null);
      } else {
        reject(new Error(`Exit code ${exitCode}`));
      }
    });
  });

  console.log(`\x1b[33m${name.toUpperCase()}\x1b[0m: \x1b[92mBUILD SUCCESSFUL\x1b[0m: ${outputFile}\n`);
};

/**
 *
 * @param {string} name
 * @param {string} src
 * @param {string} dest
 * @param {!Array<string>} args
 */
export const nasm = async (name, src, dest, args) => {
  await new Promise((resolve, reject) => {
    const child = spawn("nasm", [abs(src), "-o", abs(dest)].concat(args), {
      stdio: "inherit",
    });
    child.on("error", (err) => {
      reject(err);
    });
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve(null);
      } else {
        reject(new Error(`Exit code ${exitCode}`));
      }
    });
  });

  console.log(`\x1b[33m${name}\x1b[0m: \x1b[92mCOMPILED\x1b[0m: ${dest}\n`);
};
