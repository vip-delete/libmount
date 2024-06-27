import globals from "globals";
import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import stylistic from "@stylistic/eslint-plugin";

export default [
  js.configs.all,
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
        lm: "readonly",
      },
    },
    plugins: {
      "@stylistic": stylistic,
      jsdoc,
    },
    rules: {
      "@stylistic/arrow-parens": ["error", "always"],
      "@stylistic/brace-style": ["error", "1tbs", { "allowSingleLine": true }],
      "@stylistic/indent": ["error", 2],
      "@stylistic/no-extra-semi": "error",
      "@stylistic/quote-props": ["error", "consistent"],
      "capitalized-comments": 0,
      "class-methods-use-this": 0,
      "func-style": 0,
      "id-length": 0,
      "jsdoc/check-tag-names": ["error", { "definedTags": ["externs", "define"] }],
      "jsdoc/no-undefined-types": "error",
      "jsdoc/require-jsdoc": 0,
      "jsdoc/require-param-description": 0,
      "jsdoc/require-returns-check": 0,
      "jsdoc/require-returns-description": 0,
      "max-classes-per-file": 0,
      "max-lines": 0,
      "max-lines-per-function": ["error", 100],
      "max-params": 0,
      "max-statements": 0,
      "multiline-comment-style": 0,
      "no-bitwise": 0,
      "no-constant-condition": 0,
      "no-inline-comments": 0,
      "no-magic-numbers": 0,
      "no-param-reassign": 0,
      "no-plusplus": 0,
      "no-ternary": 0,
      "no-use-before-define": 0,
      "one-var": 0,
      "prefer-destructuring": 0,
      "prefer-template": 0,
      "sort-keys": 0,
    },
  },
];
