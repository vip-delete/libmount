import Main from "google-closure-compiler";
import js from "../src/index.mjs";
const Compiler = Main.compiler;

const path = "./src/";

const args = {
  compilation_level: "ADVANCED",
  warning_level: "VERBOSE",
  jscomp_error: "*",
  assume_function_wrapper: true,
  output_wrapper_file: path + "/wrapper.mjs.txt",
  summary_detail_level: 3,
  define: ["ENABLE_ASSERTIONS=false"],
  js_output_file: "dist/libmount.min.mjs",
  js: js.map((it) => path + it),
};

new Compiler(args).run((exitCode, stdout, stderr) => {
  if (exitCode === 0 && !stderr.includes("100.0%")) {
    exitCode = 1;
  }
  if (stdout) {
    console.log(stdout);
  }
  if (stderr) {
    console.log(stderr);
  }
  process.exit(exitCode);
});