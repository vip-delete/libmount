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
   * Mount a volume.
   *
   * @param buf Raw volume buffer.
   * @param encoding Codepage used to decode symbols in the upper half of the ASCII table (optional; defaults to cp1251).
   * @returns A FileSystem object or null if no filesystem is detected.
   */
  export function mount(buf: ArrayBuffer, encoding?: string): LmFileSystem | null;

  /**
   * Represents a file system with methods to interact with files and directories.
   */
  export interface LmFileSystem {
    /**
     * Returns the name of the mounted filesystem.
     *
     * @returns FileSystem name (e.g. FAT12, FAT16, FAT32)
     */
    getName(): string;

    /**
     * Retrieves information about the volume.
     *
     * @returns An object containing volume information.
     */
    getVolumeInfo(): LmVolumeInfo;

    /**
     * The root directory
     */
    getRoot(): LmFile;

    /**
     * Retrieves a File object located at the specified path.
     *
     * @param path The path to the file.
     * @returns The File object if found, otherwise null.
     */
    getFile(path: string): LmFile | null;
  }

  /**
   * Represents a file or directory in a file system.
   */
  export interface LmFile {
    /**
     * @returns The long name if available, otherwise returns the short name.
     */
    getName(): string;

    /**
     * @returns 8dot3 file name
     */
    getShortName(): string;

    /**
     * @returns LFN name (long file name) if exists.
     */
    getLongName(): string | null;

    /**
     * @returns The absolute path of the file or directory.
     */
    getAbsolutePath(): string;

    /**
     * @returns True if the object is a regular file (not a directory), false otherwise.
     */
    isRegularFile(): boolean;

    /**
     * @returns True if the object is a directory (or the root directory), false otherwise.
     */
    isDirectory(): boolean;

    /**
     * @returns The length of the file in bytes, or unspecified if this file is not a regular file
     */
    length(): number;

    /**
     * @returns The last modified date
     */
    lastModified(): Date;

    /**
     * @returns The creation date
     */
    creationTime(): Date;

    /**
     * @returns The last accessed date
     */
    lastAccessTime(): Date;

    /**
     * @returns The first File object which meets the predicate condition or null if this file is not a directory
     */
    findFirst(predicate: (file: File) => boolean): File | null;

    /**
     * @returns An array of File objects which meet the predicate condition or null if this file is not a directory
     */
    findAll(predicate: (file: File) => boolean): File[] | null;

    /**
     * @returns An array of File objects within this directory, or null if this file is not a directory.
     */
    listFiles(): File[] | null;

    /**
     * Reads the content of this file.
     * @returns A Uint8Array containing the file's data, or null if this file is not a regular file.
     */
    getData(): Uint8Array | null;

    /**
     * Deletes this file or directory recursive. After deletion, this file becomes unusable.
     * The root directory cannot be deleted.
     */
    delete(): void;
  }

  /**
   * Represents information about a volume.
   */
  export type LmVolumeInfo = {
    /**
     * The label or name assigned to the volume.
     */
    label: string;

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
