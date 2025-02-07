import { createDisk } from "./disk.mjs";
import { createIO } from "./io.mjs";
import { latin1 } from "./latin1.mjs";

/**
 * @param {!Uint8Array} img
 * @param {!ns.MountOptions} [options]
 * @return {!ns.Disk}
 */
export const mount = (img, options) => {
  let begin = 0;
  let end = img.length;
  const partition = options?.partition;
  if (partition) {
    begin = partition.relativeSectors * 512;
    end = begin + partition.totalSectors * 512;
  }
  const io = createIO(img.subarray(begin, end));
  return createDisk(io, options?.codepage ?? latin1);
};
