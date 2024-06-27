import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    ENABLE_ASSERTIONS: true,
  },
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      exclude: [
        "scripts",
        "public",
        "src/libmount.js",
        "src/defines.js",
        "src/support.mjs",
        "src/types.mjs",
        "src/exports.mjs",
        ...coverageConfigDefaults.exclude,
      ],
    },
  },
});
