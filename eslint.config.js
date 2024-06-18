import globals from "globals";
import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import stylistic from "@stylistic/eslint-plugin";

export default [
  js.configs.recommended,
  jsdoc.configs["flat/recommended"],
  stylistic.configs.customize({
    quotes: "double",
    semi: true,
  }),
  {
    ignores: ["dist", "public", "scripts", "tests"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        LibMount: "readonly",
      },
    },
    plugins: {
      jsdoc,
      "@stylistic": stylistic,
    },
    rules: {
      "prefer-const": "error",
      "prefer-arrow-callback": "error",
      "eqeqeq": "error",
      "curly": "error",
      "new-cap": "error",
      "no-void": "error",
      "no-var": "error",
      "no-useless-call": "error",
      "no-duplicate-imports": "error",
      "sort-imports": "error",
      "jsdoc/require-param-description": 0,
      "jsdoc/require-returns-description": 0,
      "jsdoc/check-tag-names": ["error", { "definedTags": ["externs", "define"] }],
      "jsdoc/no-undefined-types": "error",
      "jsdoc/require-jsdoc": 0,
      "@stylistic/indent": ["error", 2],
      "@stylistic/no-extra-semi": "error",
      "@stylistic/arrow-parens": ["error", "always"],
      "@stylistic/quote-props": ["error", "consistent"],
    },
  },
];
