/**
 * Mount
 *
 * @param driver - Driver or Uint8Array
 * @param options - Mount options.
 * @returns A mounted disk.
 */
export function mount(driver: RandomAccessDriver | Uint8Array, options?: MountOptions): Disk;

/**
 * Create partition table
 *
 * @param partitions - disk partitions
 * @returns 512-bytes MBR with partition table at offset 0x01BE
 */
export function fdisk(partitions: Partition[]): DiskSectors;

/**
 * Create FAT filesystem
 *
 * @param capacity - Number of bytes available for the filesystem
 * @param options - filesystem options
 * @returns filesystem parameters and a list of sectors to write on disk
 */
export function mkfsvfat(capacity: number, options?: VFATOptions): VFATResult | null;

type MountOptions = {
  /**
   * The OEM Codepage used to decode and encode FAT short names. Default is "latin1".
   */
  codepage?: Codepage;

  /**
   * Disk partition to mount.
   */
  partition?: Partition;
};

interface Codepage {
  /**
   * Decodes an array of bytes into a string.
   */
  decode(array: Uint8Array): string;

  /**
   * Encodes a string into an array bytes.
   */
  encode(text: string): Uint8Array;
}

interface Disk {
  /**
   * @returns Disk capacity in bytes
   */
  capacity(): number;

  /**
   * Retrieves the file system associated with the disk if detected.
   * Returning null may indicate the disk is either empty, partitioned, or lacks a known file system.
   *
   * @returns The file system object if available.
   */
  getFileSystem(): FileSystem | null;

  /**
   * Retrieves an array of MBR partitions on the disk.
   * The array may be empty if the disk has no partitions (e.g., like a floppy disk, or empty disk).
   *
   * @returns An array of MBR partitions.
   */
  getPartitions(): Partition[];

  /**
   * Write the given sectors on disk
   *
   * @param diskSectors - sectors to write on disk
   */
  write(diskSectors: DiskSectors): void;
}

interface FileSystem {
  /**
   * @returns The name of the file system (e.g. FAT12, FAT16, FAT32).
   */
  getName(): string;

  /**
   * @returns The volume label.
   */
  getLabel(): string | null;
  setLabel(label: string | null): void;

  /**
   * @returns OEM Name Identifier. Typically this is some indication of what system formatted the volume.
   */
  getOEMName(): string | null;

  /**
   * @returns The volume serial number.
   */
  getId(): number;

  /**
   * @returns The size of a cluster on the volume in bytes.
   */
  getSizeOfCluster(): number;

  /**
   * @returns Total count of clusters on the volume.
   */
  getCountOfClusters(): number;

  /**
   * @returns Number of free clusters available for allocation.
   */
  getFreeClusters(): number;

  /**
   * @returns The root directory file object.
   */
  getRoot(): File;
}

interface File {
  /**
   * Retrieves the name of the file.
   *
   * @returns The name of the file.
   */
  getName(): string;

  /**
   * Retrieves the short name (8.3 format) of the file.
   *
   * @returns The short name of the file.
   */
  getShortName(): string;

  /**
   * Retrieves the absolute path of the file.
   *
   * @returns The absolute path of the file.
   */
  getAbsolutePath(): string;

  /**
   * Checks if the file is a regular file.
   *
   * @returns True if the file is a regular file (not a directory), otherwise false.
   */
  isRegularFile(): boolean;

  /**
   * Checks if the file is a directory.
   *
   * @returns True if the file is a directory (or the root directory), otherwise false.
   */
  isDirectory(): boolean;

  /**
   * Retrieves the size of the file or the total size of all files in a directory.
   *
   * @returns The file or directory size in bytes.
   */
  length(): number;

  /**
   * Retrieves the size on disk of the current file object.
   *
   * @returns The file object size in bytes.
   */
  getSizeOnDisk(): number;

  /**
   * yyyy.MM.dd HH:mm:ss
   * @returns The time of last modification.
   */
  getLastModified(): Date | null;
  setLastModified(date: Date | null): void;

  /**
   * yyyy.MM.dd HH:mm:ss
   * @returns The time that the file was created.
   */
  getCreationTime(): Date | null;
  setCreationTime(date: Date | null): void;

  /**
   * yyyy.MM.dd
   * @returns The time of last access.
   */
  getLastAccessTime(): Date | null;
  setLastAccessTime(date: Date | null): void;

  /**
   * Finds the first file matching the given predicate.
   *
   * @param predicate - The predicate function.
   * @returns The first file matching the predicate, or null if not a directory or nothing found.
   */
  findFirst(predicate: (file: File) => boolean): File | null;

  /**
   * Finds all files matching the given predicate.
   *
   * @param predicate - The predicate function.
   * @returns An array of files matching the predicate or null if not a directory.
   */
  findAll(predicate: (file: File) => boolean): File[] | null;

  /**
   * Lists all files in the directory.
   *
   * @returns An array of files in the directory, or null if not a directory.
   */
  listFiles(): File[] | null;

  /**
   * @returns Linked list of the file clusters
   */
  open(): FileIO | null;

  /**
   * Deletes the file or directory recursive. After deletion, this file becomes unusable.
   * Deleting the root directory deletes all files recursive.
   */
  delete(): void;

  /**
   * Retrieves a file object given its path relative to the current file.
   *
   * @param path - The path to the file.
   * @returns The File located at the specified path, otherwise null.
   */
  getFile(relativePath: string): File | null;

  /**
   * Creates a file at the specified path, including any necessary parent directories.
   * If the file already exists, returns the existing file.
   *
   * @param relativePath - Relative path where the file should be created.
   * @returns The file located at the specified path if successfully created or already exists, otherwise null.
   */
  makeFile(relativePath: string): File | null;

  /**
   * Creates a directory at the specified path, including any necessary parent directories.
   * If the directory already exists, returns the existing directory.
   *
   * @param relativePath - Relative path where the directory should be created.
   * @returns The file located at the specified path if successfully created or already exists, otherwise null.
   */
  makeDir(relativePath: string): File | null;

  /**
   * Moves the current file to the destination path, creating any necessary parent directories.
   * - If `dest` points to an existing directory, the current file is moved into that directory.
   * - If `dest` does not exist, the current file is renamed to `dest`.
   * Root directory cannot be moved or renamed.
   *
   * @param dest - Absolute or relative to the current file path where the current file should be moved or renamed to.
   * @returns The new file object at the destination path if successfully moved or renamed, otherwise null.
   */
  moveTo(dest: string): File | null;
}

interface FileIO {
  /**
   * Set the pointer to the beginning of the file
   */
  rewind(): void;

  /**
   * Skip current file cluster
   * @returns number of bytes skipped
   */
  skipClus(): number;

  /**
   * Read current cluster to the buffer
   * @param buf - buffer to read
   * @returns number of bytes read
   */
  readClus(buf: Uint8Array): number;

  /**
   * Write the buffer to the current cluster
   * @param buf - buffer to write
   * @returns number of bytes written
   */
  writeClus(buf: Uint8Array): number;

  /**
   * @returns the whole file content
   */
  readData(): Uint8Array;

  /**
   * @param data - the whole file content
   */
  writeData(data: Uint8Array): number;
}

type VFATOptions = {
  /**
   * The volume ID/serial number.
   * Valid values are from 0 to 0xffffffff.
   * Default depends on current time.
   */
  id?: number;

  /**
   * Boot Sector.
   * Only jmpBoot (first 3 bytes) and BootCode (at offset 62 for FAT12/16 or 90 for FAT32) are used.
   */
  bs?: Uint8Array;

  /**
   * The message the user receives on attempts to boot this file system without having properly installed an operating system.
   * Max length is 424 for FAT12/16 and 395 for FAT32.
   * The bytes will be displayed in your BIOS codepage, usually CP437.
   * Default is "Non-system disk or disk error\r\nreplace and strike any key when ready\r\n".
   */
  message?: Uint8Array;

  /**
   * Filesystem type: FAT12, FAT16, or FAT32.
   * Default is whatever fits better for the file system size.
   */
  type?: string;

  /**
   * The number of file allocation tables in the file system.
   * Valid values are 1 or 2.
   * Default is 2.
   */
  numFATs?: number;

  /**
   * Minimum number of entries in the root directory (FAT12/16 only).
   * Valid values are from 1 to 512.
   * The real RootEntCnt is rounded up to the sector size:
   * if rootEntCnt=1 then real RootEntCnt is 16*CEIL(1/16)=16
   * if rootEntCnt=112 then real RootEntCnt is 16*CEIL(112/16)=112
   * This option is ignored for FAT32.
   * Default is 512, except for floppies.
   */
  rootEntCnt?: number;

  /**
   * Number of sectors per cluster. Sector is 512 bytes always.
   * For 4k cluster, secPerClus is 8.
   * Valid values are 1, 2, 4, 8, 16, 32, 64, or 128.
   * Default depends on capacity, but never 128 (64k cluster).
   */
  secPerClus?: number;

  /**
   * The volume label. 11 bytes.
   * The bytes will be displayed in your DOS/Windows codepage.
   * Default is not set.
   */
  label?: Uint8Array;

  /**
   * Compatibility level.
   * Valid range is [0-16].
   * Default is 16 (maximum compatibility).
   *
   * Notes:
   * Avoid making volumes of any type that have close to 4085 or 65525 clusters.
   * Stay 16 clusters on each side away from these cut-over cluster counts.
   * However, LibMount uses Microsoft's FAT type detection which is not spec-compliant.
   * For instance, it uses 4078 (!) as the maximum number of clusters for FAT12.
   *
   * Thus,
   * 0 means FAT12 can have from 0 to 4078 clusters. (not spec. compliant)
   * 1 means FAT12 can have from 1 to 4085 clusters. (not spec. compliant)
   * 2 means FAT12 can have from 2 to 4084 clusters. (spec. compliant)
   * ...
   * 16 means FAT12 can have from 16 to 4070 clusters. (spec. compliant)
   *
   * Overall,
   * 1. mkfs always creates DOS/Windows compatible images.
   * 2. compat=0 or compat=1 can create images which are not spec-compliant in rare cases,
   *    and some FAT drivers will not correctly detect the filesystem type.
   * 3. compat=2 and above create spec-compliant images always,
   *    but the world is full of FAT code that is wrong,
   *    and some FAT drivers will not correctly detect the filesystem type.
   * 4. compat=16 will create compatible images for all shitty FAT drivers in the world I believe.
   *
   * Also, note that Microsoft supports FAT32 images with 1, 2 or more clusters,
   * and mkfs can create such images, there is no 65525 specification limit.
   */
  compat?: number;

  // Other BootSector and BiosParameterBlock fields.

  /**
   * BS_OEMName field. Offset 3. 8 bytes.
   * Default is "LIBMNTJS".
   */
  oemName?: Uint8Array;

  /**
   * BPB_Media field. Offset 21. 1 byte.
   * Default is 0xF8, except for floppies.
   */
  media?: number;

  /**
   * BPB_SecPerTrk field. Offset 24. 2 bytes.
   * Default is 63, except for floppies.
   */
  secPerTrk?: number;

  /**
   * BPB_NumHeads field. Offset 26. 2 bytes.
   * Default is 255, except for floppies.
   */
  numHeads?: number;

  /**
   * BPB_HiddSec field. Offset 28. 2 bytes.
   * Default is 0.
   */
  hiddSec?: number;
};

type VFATResult = {
  /**
   * New filesystem sectors
   */
  sectors: DiskSectors;

  /**
   * Volume Id/serial number.
   */
  id: number;

  /**
   * FileSystem type: FAT12, FAT16 or FAT32.
   */
  type: string;

  /**
   * Total number of sectors in use.
   * totSec = rsvdSecCnt + numFATs * fatSz + rootDirSectors + countOfClusters * sizeOfCluster / bytsPerSec
   */
  totSec: number;

  /**
   * Number of reserved sectors.
   */
  rsvdSecCnt: number;

  /**
   * Number of FATs. 1 or 2.
   */
  numFATs: number;

  /**
   * Number of sectors per FAT.
   */
  fatSz: number;

  /**
   * Number of sectors for Root Directory. Always 0 for FAT32.
   */
  rootDirSectors: number;

  /**
   * Number of clusters.
   */
  countOfClusters: number;

  /**
   * Number of sectors per clusters: 1, 2, 4, 8, 16, 32, 64, or 128.
   */
  secPerClus: number;

  /**
   * Size of sector in bytes: 512 always.
   */
  bytsPerSec: number;
};

type Partition = {
  /**
   * Flag indicating whether the partition is active.
   */
  active: boolean;

  /**
   * Partition Type (e.g. 0xE for FAT).
   */
  type: number;

  /**
   * Offset (in sectors) from the beginning of the disk to the start of the partition.
   */
  relativeSectors: number;

  /**
   * Total sectors in the partition.
   */
  totalSectors: number;
};

/**
 * A set of sectors which define a filesystem or other disk structures.
 */
type DiskSectors = {
  bytsPerSec: number;
  zeroRegions: Array<ZeroRegion>;
  dataSectors: Array<DataSector>;
};

type ZeroRegion = {
  /**
   * Sector index, 0-based.
   */
  i: number;
  /**
   * Number of zero sectors.
   */
  count: number;
};

type DataSector = {
  /**
   * Sector index, 0-based.
   */
  i: number;
  /**
   * Sector bytes.
   */
  data: Uint8Array;
};

/**
 * Random-access storage device driver.
 */
type RandomAccessDriver = {
  /**
   * Total storage capacity in bytes.
   */
  readonly capacity: number;

  /**
   * Reads data.
   *
   * @param address - The byte offset to begin reading from. Must be >= 0 and < capacity.
   * @param count - The number of bytes to read.
   * @returns {Uint8Array} A buffer containing the requested data.
   */
  read(address: number, count: number): Uint8Array;

  /**
   * Writes data. Optional for readonly drivers.
   *
   * @param address - The byte offset to begin writing to.
   * @param data - The buffer containing data to write.
   */
  write?(address: number, data: Uint8Array): void;

  /**
   * Release resources. Options. Not used by libmount.
   */
  close?(): void;
};

