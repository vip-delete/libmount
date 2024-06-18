import { loadBootSector, loadFATVariables } from "./model.mjs";
import { BlockDevice } from "./io.mjs";
import { FAT12Driver } from "./driver.mjs";
import { FATFileSystem } from "./filesystem.mjs";

/**
 * @param {!ArrayBuffer} buf
 * @param {string} [encoding]
 * @returns {?FATFileSystem}
 */
export function mount(buf, encoding = "cp1251") {
  const s = new BlockDevice(buf);

  // check signature
  s.pos = 510;
  const sig = s.readWord();
  if (sig !== 0xaa55) {
    return null;
  }

  // load boot sector
  s.pos = 0;
  const bs = loadBootSector(s);

  // calculate variables which are used in specification
  const vars = loadFATVariables(bs);

  // A FAT12 volume cannot contain more than 4084 clusters.
  if (vars.CountOfClusters < 4085) {
    const driver = new FAT12Driver(s, bs, vars, encoding);
    return new FATFileSystem(driver);
  }

  // A FAT16 volume cannot contain less than 4085 clusters or more than 65,524 clusters.
  if (vars.CountOfClusters < 65525) {
    return null;
  }

  // FAT32
  return null;
}
