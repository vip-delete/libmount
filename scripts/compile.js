/* global process */
/* eslint-disable no-console */
/* eslint-disable camelcase */

import Main from "google-closure-compiler";
import fs from "fs";
import srcFiles from "../src/index.mjs";
const Compiler = Main.compiler;

fs.rmSync("./dist", { recursive: true });
fs.cpSync("./src/codepages", "./dist/codepages", { recursive: true });

const srcJs = srcFiles.map((it) => "./src/" + it);

const args = {
  compilation_level: "ADVANCED",
  warning_level: "VERBOSE",
  jscomp_error: "*",
  jscomp_warning: "reportUnknownTypes",
  assume_function_wrapper: true,
  output_wrapper_file: "./src/wrapper.mjs.txt",
  summary_detail_level: 3,
  use_types_for_optimization: true,
  define: [
    //
    "ENABLE_LOGGER=false",
    "ENABLE_ASSERTIONS=false",
  ],
  js_output_file: "./dist/libmount.min.mjs",
  js: [
    //
    "./src/module.js",
    "./src/codepages/codepage.mjs",
    "./src/codepages/cp1252.mjs",
  ].concat(srcJs),
};

new Compiler(args).run((exitCode, stdout, stderr) => {
  if (stdout) {
    console.log(stdout);
  }
  if (stderr) {
    console.log(stderr);
  }

  if (exitCode === 0 && !stderr.includes("100.0%")) {
    console.log("\x1b[91mBUILD FAILED\x1b[0m: 100.0% is required\n");
    process.exit(2);
  }

  console.log(exitCode === 0 ? "\x1b[92mBUILD SUCCESSFUL\x1b[0m\n" : "\x1b[91mBUILD FAILED\x1b[0m\n");
  process.exit(exitCode);
});
