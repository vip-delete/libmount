import { BlockDevice } from "./io.mjs";
import { FATFileSystem } from "./filesystem.mjs";
import { GenericFATDriver } from "./driver.mjs";

/**
 * @param {!ArrayBuffer} buf
 * @param {string} [encoding]
 * @returns {?lm.FileSystem}
 */
export function mount(buf, encoding = "cp1251") {
  if (buf.byteLength < 512) {
    return null;
  }

  const s = new BlockDevice(buf);

  // check signature
  s.pos = 510;
  const sig = s.readWord();
  if (sig !== 0xaa55) {
    return null;
  }

  try {
    return new FATFileSystem(new GenericFATDriver(s, encoding));
  } catch {
    return null;
  }
}
