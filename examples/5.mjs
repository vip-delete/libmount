import { writeFileSync } from "../scripts/commons.mjs";
import { fdisk } from "../src/fdisk.mjs";
import { mount } from "../src/mount.mjs";

// Create boot sector with partition table

const img = new Uint8Array(512);
const disk = mount(img);
disk.write(
  fdisk([
    {
      active: true,
      type: 6,
      relativeSectors: 2048, // 1M offset
      totalSectors: 195369519,
    },
  ]),
);
writeFileSync(`temp/bs.img`, img);

const [partition] = mount(img).getPartitions();
console.log(partition);
/**
{
  active: true,
  type: 6,
  relativeSectors: 2048,
  totalSectors: 195369519
}
 */
