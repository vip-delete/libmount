import Main from "google-closure-compiler";
import js from "../src/index.mjs";
import fs from "fs";
const Compiler = Main.compiler;

const src = "./src";
const dist = "./dist";
const output_file = dist + "/libmount.min.mjs";
const charmap_file = dist + "/charmap.mjs";

if (!fs.existsSync(dist)){
  fs.mkdirSync(dist);
}
fs.copyFileSync(src + "/charmap.mjs", charmap_file);

const args = {
  compilation_level: "ADVANCED",
  warning_level: "VERBOSE",
  jscomp_error: "*",
  jscomp_warning: "reportUnknownTypes",
  assume_function_wrapper: true,
  output_wrapper_file: src + "/wrapper.mjs.txt",
  summary_detail_level: 3,
  define: ["ENABLE_ASSERTIONS=false"],
  js_output_file: output_file,
  js: js.map((it) => src + "/" + it),
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

  console.log(exitCode == 0 ? "\x1b[92mBUILD SUCCESSFUL\x1b[0m\n" : "\x1b[91mBUILD FAILED\x1b[0m\n");
  process.exit(exitCode);
});
