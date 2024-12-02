import { compile, copyFileSync } from "./commons.mjs";

const USE_CLOSURE_COMPILER = true;

if (USE_CLOSURE_COMPILER) {
  await compile(
    "lib-mount",
    `src/headers/lm-wrapper.txt`,
    `dist/libmount.min.mjs`,
    [
      "src/headers/lm-externs.mjs",
      "src/headers/lm-defines.mjs",
      "src/support.mjs",
      "src/latin1.mjs",
      //
      "src/types.mjs",
      "src/io.mjs",
      "src/utils.mjs",
      //
      "src/loaders.mjs",
      "src/fs.mjs",
      //
      "src/math.mjs",
      "src/crawler.mjs",
      "src/driver.mjs",
      "src/lm.mjs",
      //
      "src/headers/lm-exports.mjs",
    ],
    "BROWSER",
    [
      //
      "ENABLE_LOGGER=false",
      "ENABLE_ASSERTIONS=false",
    ],
  );
} else {
  [
    //
    "lm.mjs",
  ].forEach((it) => {
    copyFileSync(`src/${it}`, `dist/${it}`);
  });
}
