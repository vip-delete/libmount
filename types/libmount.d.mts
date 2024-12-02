/**
 * Mount a raw image.
 *
 * @param img A Raw image.
 * @param options Mount options.
 * @returns A mounted disk.
 */
export function mount(img: Uint8Array, options?: MountOptions): Disk;

/**
 * Represents the mount options.
 */
type MountOptions = {
  /**
   * The encoding used to decode and encode FAT short names. Default is "latin1".
   */
  encoding?: Encoding;

  /**
   * Disk partition to mount.
   */
  partition?: Partition;
};

/**
 * Represents an Encoding.
 */
interface Encoding {
  /**
   * Decodes an array of bytes into a string.
   */
  decode(array: Uint8Array): string;

  /**
   * Encodes a string into an array bytes.
   */
  encode(text: string): Uint8Array;
}

/**
 * Represents a disk.
 */
interface Disk {
  /**
   * Retrieves the file system associated with the disk if detected.
   * Returning null may indicate the disk is either empty, partitioned, or lacks a known file system.
   * @returns The file system object if available.
   */
  getFileSystem(): FileSystem | null;

  /**
   * Retrieves an array of MBR partitions on the disk.
   * The array may be empty if the disk has no partitions (e.g., like a floppy disk, or empty disk).
   * @returns An array of MBR partitions.
   */
  getPartitions(): Partition[];
}

/**
 * Represents a file system.
 */
interface FileSystem {
  /**
   * Retrieves the name of the file system.
   * @returns The name of the file system (e.g. FAT12, FAT16, FAT32).
   */
  getName(): string;

  /**
   * Retrieves volume information associated with the file system.
   * @returns Volume.
   */
  getVolume(): Volume;

  /**
   * Retrieves the root directory of the file system.
   * @returns The root directory file object.
   */
  getRoot(): File;
}

/**
 * Represents a file or directory in a file system.
 */
interface File {
  /**
   * Retrieves the name of the file.
   * @returns The name of the file.
   */
  getName(): string;

  /**
   * Retrieves the short name (8.3 format) of the file.
   * @returns The short name of the file.
   */
  getShortName(): string;

  /**
   * Retrieves the absolute path of the file.
   * @returns The absolute path of the file.
   */
  getAbsolutePath(): string;

  /**
   * Checks if the file is a regular file.
   * @returns True if the file is a regular file (not a directory), otherwise false.
   */
  isRegularFile(): boolean;

  /**
   * Checks if the file is a directory.
   * @returns True if the file is a directory (or the root directory), otherwise false.
   */
  isDirectory(): boolean;

  /**
   * Retrieves the size of the file or the total size of all files in a directory.
   * @returns The file or directory size in bytes.
   */
  length(): number;

  /**
   * Retrieves the size on disk of the current file object.
   * @returns The file object size in bytes.
   */
  getSizeOnDisk(): number;

  /**
   * Retrieves the last modified timestamp of the file.
   * @returns The last modified timestamp of the file.
   */
  lastModified(): Date | null;

  /**
   * Retrieves the creation timestamp of the file.
   * @returns The creation timestamp of the file.
   */
  creationTime(): Date | null;

  /**
   * Retrieves the last access timestamp of the file.
   * @returns The last access timestamp of the file.
   */
  lastAccessTime(): Date | null;

  /**
   * Finds the first file matching the given predicate.
   * @param predicate The predicate function.
   * @returns The first file matching the predicate, or null if not a directory or nothing found.
   */
  findFirst(predicate: (file: File) => boolean): File | null;

  /**
   * Finds all files matching the given predicate.
   * @param predicate The predicate function.
   * @returns An array of files matching the predicate or null if not a directory.
   */
  findAll(predicate: (file: File) => boolean): File[] | null;

  /**
   * Lists all files in the directory.
   * @returns An array of files in the directory, or null if not a directory.
   */
  listFiles(): File[] | null;

  /**
   * Retrieves the data content of the file.
   * @returns The data content of the file, or null if not a regular file.
   */
  getData(): Uint8Array | null;

  /**
   * Set the content to the current file.
   * @param data File content.
   * @returns This file if success, null otherwise.
   */
  setData(data: Uint8Array): File | null;

  /**
   * Deletes the file or directory recursive. After deletion, this file becomes unusable.
   * Deleting the root directory deletes all files recursive.
   */
  delete(): void;

  /**
   * Retrieves a file object given its path relative to the current file.
   * @param path The path to the file.
   * @returns The File located at the specified path, otherwise null.
   */
  getFile(relativePath: string): File | null;

  /**
   * Creates a file at the specified path, including any necessary parent directories.
   * If the file already exists, returns the existing file.
   *
   * @param relativePath Relative path where the file should be created.
   * @returns The file located at the specified path if successfully created or already exists, otherwise null.
   */
  makeFile(relativePath: string): File | null;

  /**
   * Creates a directory at the specified path, including any necessary parent directories.
   * If the directory already exists, returns the existing directory.
   *
   * @param relativePath Relative path where the directory should be created.
   * @returns The file located at the specified path if successfully created or already exists, otherwise null.
   */
  makeDir(relativePath: string): File | null;

  /**
   * Moves the current file to the destination path, creating any necessary parent directories.
   * - If `dest` points to an existing directory, the current file is moved into that directory.
   * - If `dest` does not exist, the current file is renamed to `dest`.
   * Root directory cannot be moved or renamed.
   * @param dest Absolute or relative to the current file path where the current file should be moved or renamed to.
   * @returns The new file object at the destination path if successfully moved or renamed, otherwise null.
   */
  moveTo(dest: string): File | null;
}

/**
 * Represents a file system volume
 */
interface Volume {
  /**
   * The volume label.
   */
  getLabel(): string | null;
  setLabel(label: string | null): void;
  /**
   * OEM Name Identifier. Typically this is some indication of what system formatted the volume.
   */
  getOEMName(): string | null;
  setOEMName(oemName: string | null): void;
  /**
   * The volume serial number.
   */
  getId(): number;
  setId(id: number): void;
  /**
   * The size of a cluster on the volume in bytes.
   */
  getSizeOfCluster(): number;
  /**
   * Total count of clusters on the volume.
   */
  getCountOfClusters(): number;
  /**
   * Number of free clusters available for allocation.
   */
  getFreeClusters(): number;
}

/**
 * Represents the disk partition information.
 */
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
   * Offset (in bytes) from the beginning of the disk to the start of the partition.
   */
  begin: number;

  /**
   * Offset (in bytes) from the beginning of the disk to the end of the partition.
   */
  end: number;
};
