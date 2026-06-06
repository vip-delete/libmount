import { fdisk, mkfsvfat, mount } from "../src/index.mjs";
libmount.fdisk = fdisk;
libmount.mkfsvfat = mkfsvfat;
libmount.mount = mount;
