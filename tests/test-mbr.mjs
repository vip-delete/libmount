import { expect, test } from "vitest";
import { gunzipSync } from "zlib";
import { readFileSync } from "fs";

export function mbr(mount) {
  const partitions = mount(new Uint8Array(gunzipSync(readFileSync("./public/images/mbr.img.gz", { flag: "r" })))).getPartitions();

  const M = 1024 * 1024;

  test("mbr", () => {
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
      begin: M,
      end: 129 * M,
    });
    expect(partitions[1]).toStrictEqual({
      //
      active: false,
      type: 0xc,
      begin: 129 * M,
      end: 512 * M,
    });
  });
}
