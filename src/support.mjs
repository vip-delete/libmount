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

/**
 * @param {boolean} expression
 */
export function validate(expression) {
  if (!expression) {
    throw Error();
  }
}
