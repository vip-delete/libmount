import { mount } from "libmount";
import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readBinaryFileSync } from "../scripts/commons.mjs";

test("mbr", () => {
  const partitions = mount(new Uint8Array(gunzipSync(readBinaryFileSync("tests/images/mbr.img.gz")))).getPartitions();
  const mb = 1024 * 1024;
  expect(partitions.length).toBe(2);

  // +----------+-------------+-------------+
  // |          | Partition 1 | Partition 2 |
  // |----------|-------------|-------------|
  // |    1M    |    128 M    |    383 M    |
  // +----------+-------------+-------------+
  //             ^             ^             ^
  //             |             |             |
  //             offset=1M     offset=129M   total=512M
  expect(partitions[0]).toStrictEqual({
    //
    active: false,
    type: 0xe,
    relativeSectors: mb / 512,
    totalSectors: (128 * mb) / 512,
  });
  expect(partitions[1]).toStrictEqual({
    //
    active: false,
    type: 0xc,
    relativeSectors: (129 * mb) / 512,
    totalSectors: ((512 - 128 - 1) * mb) / 512,
  });
});
