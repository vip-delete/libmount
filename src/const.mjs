export const MAX_BYTE = 0xff;
export const MAX_WORD = 0xffff;
export const MAX_DOUBLE_WORD = 0xffffffff;

export const BS_JUMP_BOOT_LENGTH = 3;
export const BS_OEM_NAME_LENGTH = 8;
export const DIR_NAME_LENGTH = 11;
export const BS_FIL_SYS_TYPE_LENGTH = 8;
export const BPB_FAT32_RESERVED_LENGTH = 12;
export const BS_BOOT_CODE_LENGTH = 448;
export const BS_BOOT_CODE_FAT32_LENGTH = 420;
export const BS_SIGNATURE_WORD = 0xaa55;
export const FSI_LEAD_SIG = 0x41615252;
export const FSI_STRUC_SIG = 0x61417272;
export const FSI_TRAIL_SIG = 0xaa550000;
export const FSI_NEXT_FREE_OFFSET = 492;

export const LFN_MAX_LEN = 255;
export const LFN_NAME1_LENGTH = 10;
export const LFN_NAME2_LENGTH = 12;
export const LFN_NAME3_LENGTH = 4;
export const LFN_ALL_NAMES_LENGTH = LFN_NAME1_LENGTH + LFN_NAME2_LENGTH + LFN_NAME3_LENGTH;
export const LFN_BUFFER_LEN = 520; // 2 * LFN_ALL_NAMES_LENGTH * Math.ceil(LFN_MAX_LEN / LFN_ALL_NAMES_LENGTH);

export const DIR_CRT_DATE_TIME_OFFSET = 13;
export const DIR_LST_ACC_DATE_OFFSET = 18;
export const DIR_FST_CLUS_HI_OFFSET = 20;
export const DIR_WRT_DATE_TIME_OFFSET = 22;
export const DIR_FST_CLUS_LO_OFFSET = 26;
export const DIR_FILE_SIZE_OFFSET = 28;

/**
 * 2^5 = 32 bytes per dir entry
 */
export const DIR_ENTRY_SIZE_BITS = 5;
export const DIR_ENTRY_SIZE = 1 << DIR_ENTRY_SIZE_BITS;

// Microsoft FAT specification:
//
// FAT12 Clus#: 0 1 2   ....   FF5 FF6 FF7 FF8  ....  FFE FFF
//              | | |           |   |   |   |          |   |
//              | | └ Allocated ┘   |   |   └ Reserved ┘   └ EOF
//              | └ Not Used        |   └ Bad
//              └ Free              └ Reserved
// export const SPEC_MAX_COUNT_OF_CLUSTERS_FAT12 = 0xff5 - 1; // 4084
// export const SPEC_MAX_COUNT_OF_CLUSTERS_FAT16 = 0xfff5 - 1; // 65524
// export const SPEC_MAX_COUNT_OF_CLUSTERS_FAT32 = 0xffffff5 - 1; // 268435444

// Windows FAT driver doesn't follow Microsoft FAT specification
// https://github.com/microsoft/Windows-driver-samples/blob/main/filesys/fastfat/fat.h#L516
// #define FatIndexBitSize(B) ((UCHAR)(IsBpbFat32(B) ? 32 : (FatNumberOfClusters(B) < 4087 ? 12 : 16)))
export const FAT_THRESHOLD = 4087;

// Windows practical limits:
export const WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT12 = 0; // because why not?
export const WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT12 = 0xff5 - 1 - 6; // 4078
export const WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT16 = FAT_THRESHOLD;
export const WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT16 = 0xfff5 - 1 - 6; // 65518
export const WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT32 = 1; // because it works.
export const WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT32 = 0xffffff5 - 1 - 6; // 4,294,967,278

/**
 * NOTE: As is noted numerous times earlier, the world is full of FAT code that is wrong.
 * There is a lot of FAT type code that is off by 1 or 2 or 8 or 10 or 16.
 * For this reason, it is highly recommended that if you are formatting a FAT volume
 * which has maximum compatibility with all existing FAT code, then you should you avoid
 * making volumes of any type that have close to 4,085 or 65,525 clusters.
 * Stay at least 16 clusters on each side away from these cut-over cluster counts.
 */
export const COUNT_OF_CLUSTERS_COMPATIBILITY = 16;

export const MIN_CLUS_NUM = 2;
export const FREE_CLUS = 0;

export const DIR_ENTRY_ATTR_READ_ONLY = 0x01;
export const DIR_ENTRY_ATTR_HIDDEN = 0x02;
export const DIR_ENTRY_ATTR_SYSTEM = 0x04;
export const DIR_ENTRY_ATTR_VOLUME_ID = 0x08;
export const DIR_ENTRY_ATTR_DIRECTORY = 0x10;
export const DIR_ENTRY_ATTR_ARCHIVE = 0x20;
export const DIR_ENTRY_ATTR_LFN = 0xf; // READ_ONLY | HIDDEN | SYSTEM | VOLUME_ID

export const DIR_ENTRY_FLAG_LAST = 0x00;
export const DIR_ENTRY_FLAG_DELETED = 0xe5;
export const DIR_ENTRY_FLAG_E5 = 0x05; // DIR_Name[0]=0x05 means 0xE5 in the SFN.
