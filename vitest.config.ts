import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test/javascript/libmount/setup-defines.js"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      exclude: ["scripts", "public", "src/test", "**/api.js", "**/defines.js", "**/exports.mjs", ...coverageConfigDefaults.exclude],
    },
  },
});
