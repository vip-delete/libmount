import fs from "fs";
import Main from "google-closure-compiler";
import Path from "path";
import { fileURLToPath } from "url";

export function getHeader() {
  const json = JSON.parse(readFileSync("package.json"));
  return `/**
* This file is part of LibMount v${json.version}
* (c) 2025-present ${json.author}
* @license ${json.license}
**/
`;
}

/**
 * @param {string} rel
 * @returns {string}
 */
export function abs(rel) {
  return Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), "../" + rel);
}

/**
 * @param {string} dir
 */
export function rmSync(dir) {
  if (fs.existsSync(abs(dir))) {
    console.log(`DELETE: ${dir}`);
    fs.rmSync(abs(dir), { recursive: true });
  }
}

/**
 * @param {string} src
 * @param {string} dest
 */
export function copyFileSync(src, dest) {
  fs.copyFileSync(abs(src), abs(dest));
}

/**
 * @param {string} filename
 * @returns {string}
 */
export function readFileSync(filename) {
  return fs.readFileSync(abs(filename), "utf-8");
}

/**
 * @param {string} name
 * @param {string} wrapperFile
 * @param {string} outputFile
 * @param {string[]} files
 * @param {string} target
 * @param {!Array<string>} defines
 */
export async function compile(name, wrapperFile, outputFile, files, target, defines) {
  const args = {
    /* eslint-disable camelcase */
    module_resolution: target ?? "BROWSER",
    compilation_level: "ADVANCED",
    warning_level: "VERBOSE",
    jscomp_error: "*",
    jscomp_warning: "reportUnknownTypes",
    assume_function_wrapper: true,
    output_wrapper: getHeader() + readFileSync(wrapperFile),
    summary_detail_level: String(3),
    use_types_for_optimization: true,
    define: defines,
    js_output_file: abs(outputFile),
    charset: "utf-8",
    js: files.map(abs),
    /* eslint-enable camelcase */
  };

  const Compiler = Main.compiler;
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
}
