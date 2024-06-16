"use strict";

/**
 * @define {boolean}
 */
const DEBUG = true;

/**
 * @define {boolean}
 */
const ENABLE_ASSERTIONS = true;

/**
 * @param {boolean} expression
 * @param {string} [msg]
 */
function assert(expression, msg) {
  if (ENABLE_ASSERTIONS) {
    if (!expression) {
      throw msg ?? "AssertionError";
    }
  }
}
