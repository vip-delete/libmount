/* global ENABLE_ASSERTIONS */

/**
 * @param {boolean} expression
 * @param {string} [msg]
 */
export function assert(expression, msg) {
  if (ENABLE_ASSERTIONS) {
    if (!expression) {
      throw msg ?? "AssertionError";
    }
  }
}
