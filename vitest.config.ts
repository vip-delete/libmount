import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["text"],
      include: ["src/**/*.mjs"],
      exclude: ["src/externs.mjs", "src/log.mjs", "src/types.mjs"],
    },
  },
});
