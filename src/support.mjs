/* global ENABLE_LOGGER, ENABLE_ASSERTIONS */

/**
 * @param {boolean} expression
 * @param {string} [msg]
 */
export function assert(expression, msg) {
  // @ts-ignore
  if (ENABLE_ASSERTIONS) {
    if (!expression) {
      throw new Error(msg ?? "AssertionError");
    }
  }
}

/**
 * @returns {null}
 */
export function impossibleNull() {
  assert(false);
  return null;
}

/**
 * @returns {number}
 */
export function impossibleZero() {
  assert(false);
  return 0;
}

export class Logger {
  /**
   * @param {string} name
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * @param {string} msg
   */
  debug(msg) {
    // @ts-ignore
    if (ENABLE_LOGGER) {
      console.debug(`${timestamp()} DEBUG [${this.name}] ${msg}`);
    }
  }

  /**
   * @param {string} msg
   */
  warn(msg) {
    // @ts-ignore
    if (ENABLE_LOGGER) {
      console.warn(`${timestamp()} WARN  [${this.name}] ${msg}`);
    }
  }
}

/**
 * @returns {string}
 */
function timestamp() {
  return new Date().toLocaleString();
}

/**
 * @param {boolean} expression
 */
export function validate(expression) {
  if (!expression) {
    throw Error();
  }
}
