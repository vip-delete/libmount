import Main from "google-closure-compiler";
import js from "../src/main/javascript/libmount/index.mjs";
const { compiler } = Main;

const path = "./src/main/javascript/libmount/";

const args = {
  compilation_level: "ADVANCED",
  warning_level: "VERBOSE",
  jscomp_error: "*",
  assume_function_wrapper: true,
  output_wrapper_file: path + "/wrapper.mjs.txt",
  summary_detail_level: 3,
  define: "DEBUG=false",
  js_output_file: "dist/libmount.min.mjs",
  js: js.map((it) => path + it),
};

new compiler(args).run((exitCode, stdout, stderr) => {
  if (exitCode == 0 && !stderr.includes("100.0%")) {
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
