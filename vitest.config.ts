import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    ENABLE_LOGGER: true,
    ENABLE_ASSERTIONS: true,
  },
  test: {
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html"],
      exclude: [
        "examples",
        "public",
        "scripts",
        "types",
        "src/headers",
        ...coverageConfigDefaults.exclude,
      ],
    },
  },
});
