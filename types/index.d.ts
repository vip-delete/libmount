/**
 * Declaration file for the npm module "libmount".
 *
 * This module provides TypeScript declarations for interacting with the "libmount" library,
 *
 * @remarks
 * The "libmount" library typically includes functionality for mounting and unmounting filesystems,
 * managing mount points, and querying mounted filesystems.
 *
 * @see {@link https://www.npmjs.com/package/libmount}
 */
declare module "libmount" {
  /**
   * Mount a raw image.
   *
   * @param img raw image
   * @param codepage Codepage used to decode symbols in the upper half of the ASCII table (optional, defaults to cp1252).
   * @returns A mounted disk.
   */
  export function mount(img: Uint8Array, codepage?: string): LmDisk;

  /**
   * Represents a disk.
   */
  export interface LmDisk {
    /**
     * Retrieves the file system associated with the disk if detected.
     * Returning null may indicate the disk is either empty, partitioned, or lacks a known file system.
     * @returns The file system object if available.
     */
    getFileSystem(): LmFileSystem | null;

    /**
     * Retrieves an array of MBR partitions on the disk.
     * The array may be empty if the disk has no partitions (e.g., like a floppy disk, or empty disk).
     * @returns An array of MBR partitions.
     */
    getPartitions(): LmPartition[];
  }

  /**
   * Represents a file system.
   */
  export interface LmFileSystem {
    /**
     * Retrieves the name of the file system.
     * @returns The name of the file system (e.g. FAT12, FAT16, FAT32).
     */
    getName(): string;

    /**
     * Retrieves volume information associated with the file system.
     * @returns Volume information structure
     */
    getVolumeInfo(): LmVolumeInfo;

    /**
     * Retrieves the root directory of the file system.
     * @returns The root directory file object
     */
    getRoot(): LmFile;

    /**
     * Retrieves a file object given its path.
     * @param path The path to the file.
     * @returns The File located at the specified path, otherwise null.
     */
    getFile(path: string): LmFile | null;
  }

  /**
   * Represents a file or directory in a file system.
   */
  export interface LmFile {
    /**
     * Retrieves the name of the file.
     * @returns The name of the file.
     */
    getName(): string;

    /**
     * Retrieves the short name (8.3 format) of the file.
     * @returns The short name of the file
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
     * Retrieves the length of the file in bytes.
     * @returns The length of the file in bytes, or unspecified if not a regular file
     */
    length(): number;

    /**
     * Retrieves the last modified timestamp of the file.
     * @returns The last modified timestamp of the file.
     */
    lastModified(): Date;

    /**
     * Retrieves the creation timestamp of the file.
     * @returns The creation timestamp of the file.
     */
    creationTime(): Date;

    /**
     * Retrieves the last access timestamp of the file.
     * @returns The last access timestamp of the file.
     */
    lastAccessTime(): Date;

    /**
     * Finds the first file matching the given predicate.
     * @param predicate The predicate function.
     * @returns The first file matching the predicate, or null if not a directory or nothing found.
     */
    findFirst(predicate: (file: LmFile) => boolean): LmFile | null;

    /**
     * Finds all files matching the given predicate.
     * @param predicate The predicate function.
     * @returns An array of files matching the predicate or null if not a directory.
     */
    findAll(predicate: (file: LmFile) => boolean): LmFile[] | null;

    /**
     * Lists all files in the directory.
     * @returns An array of files in the directory, or null if not a directory.
     */
    listFiles(): LmFile[] | null;

    /**
     * Retrieves the data content of the file.
     * @returns The data content of the file, or null if not a regular file.
     */
    getData(): Uint8Array | null;

    /**
     * Deletes the file or directory recursive. After deletion, this file becomes unusable.
     * The root directory cannot be deleted.
     */
    delete(): void;
  }

  /**
   * Represents the disk partition information
   */
  export type LmPartition = {
    /**
     * Flag indicating whether the partition is active.
     */
    active: boolean;

    /**
     * Partition Type (e.g. 0xE for FAT)
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

  /**
   * Represents information about a volume.
   */
  export type LmVolumeInfo = {
    /**
     * The label or name assigned to the volume.
     */
    label: string;

    /**
     * OEM Name Identifier. Typically this is some indication of what system formatted the volume
     */
    OEMName: string;

    /**
     * The volume serial number.
     */
    serialNumber: number;

    /**
     * The size of a cluster on the volume in bytes.
     */
    clusterSize: number;

    /**
     * Total number of clusters on the volume.
     */
    totalClusters: number;

    /**
     * Number of free clusters available for allocation.
     */
    freeClusters: number;
  };
}
