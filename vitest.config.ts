import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup-defines.js"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      exclude: ["scripts", "public", "**/api.js", "**/defines.js", "**/exports.mjs", "**/support.mjs", ...coverageConfigDefaults.exclude],
    },
  },
});
