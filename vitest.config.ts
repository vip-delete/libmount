import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["text"],
      include: ["src/**/*.mjs"],
      exclude: ["src/defines.mjs", "src/externs.mjs", "src/log.mjs", "src/types.mjs"],
    },
  },
});
