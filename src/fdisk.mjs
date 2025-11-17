import { writePartitionTable } from "./dao.mjs";
import { createIO } from "./io.mjs";

/**
 * @param {!Array<!ns.Partition>} partitions
 * @return {!ns.DiskSectors}
 */
export const fdisk = (partitions) => {
  const bs = new Uint8Array(512);
  writePartitionTable(
    createIO(bs),
    partitions.map(({ active, type, relativeSectors, totalSectors }) => {
      // const TH = 255;
      // const TS = 63;
      // const Starting = lba2chs(RelativeSectors, TH, TS);
      // const Ending = lba2chs(RelativeSectors + TotalSectors, TH, TS);
      const noCHS = { Cylinder: 0, Head: 0, Sector: 0 };
      return {
        BootIndicator: active ? 0x80 : 0,
        Starting: noCHS,
        SystemID: type,
        Ending: noCHS,
        RelativeSectors: relativeSectors,
        TotalSectors: totalSectors,
      };
    }),
  );

  return {
    bytsPerSec: 512,
    zeroRegions: [],
    dataSectors: [{ i: 0, data: bs }],
  };
};
