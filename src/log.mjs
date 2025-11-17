import { Logger } from "./types.mjs";

// @ts-expect-error
// eslint-disable-next-line no-undef
const LOG_ENABLED = typeof USE_LOG === "boolean" ? USE_LOG : true;

/**
 * @implements {Logger}
 */
class Console {
  /**
   * @param {string} name
   */
  constructor(name) {
    this.name = name;
  }

  // Log

  /**
   * @override
   * @param {string} msg
   * @param {!Error} [e]
   */
  // @ts-expect-error
  warn(msg, e) {
    if (LOG_ENABLED) {
      // eslint-disable-next-line no-undef
      console.warn(`${new Date().toLocaleString()} WARN  [${this.name}] ${msg}`);
      if (e) {
        // eslint-disable-next-line no-undef
        console.warn(e);
      }
    }
  }
}

// Export

/**
 * @param {string} name
 * @return {!Logger}
 */
export const createLogger = (name) => new Console(name);
