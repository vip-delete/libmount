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
   * @returns A FileSystem object if mounted successfully, otherwise null.
   */
  export function mount(buf: ArrayBuffer, encoding?: string): FileSystem | null;

  /**
   * Represents a file system with methods to interact with files and directories.
   */
  export interface FileSystem {
    /**
     * Retrieves information about the volume.
     *
     * @returns An object containing volume information.
     */
    getVolumeInfo(): VolumeInfo;

    /**
     * Retrieves the root directory of the file system.
     *
     * @returns The root File object.
     */
    getRoot(): File;

    /**
     * Retrieves a File object located at the specified path.
     *
     * @param path The path to the file.
     * @returns The File object if found, otherwise null.
     */
    getFile(path: string): File | null;

    /**
     * Lists all files within a specified directory.
     *
     * @param file The directory to list files from.
     * @returns An array of File objects, or null if the the given file is not a directory.
     */
    listFiles(file: File): File[] | null;

    /**
     * Reads the contents of a specified file.
     *
     * @param file The file to read.
     * @returns A Uint8Array containing the file's data, or null if the given file is not a regular file.
     */
    readFile(file: File): Uint8Array | null;

    /**
     * Deletes a specified file or directory recursive. After deletion, all deleted files become unusable.
     * The root directory cannot be deleted.
     *
     * @param file The file to delete.
     */
    deleteFile(file: File): void;
  }

  /**
   * Represents a file or directory in a file system.
   */
  export interface File {
    /**
     * @returns The long name if available, otherwise returns the short name.
     */
    getName(): string;

    /**
     * @returns The short name (8.3 name) of the file or directory.
     */
    getShortName(): string;

    /**
     * @returns The long name (LFN) of the file or directory, or null if not available.
     */
    getLongName(): string | null;

    /**
     * @returns The absolute path of the file or directory.
     */
    getAbsolutePath(): string;

    /**
     * @returns true if the object is a regular file, false otherwise.
     */
    isRegularFile(): boolean;

    /**
     * @returns True if the object is a directory or the root directory, false otherwise.
     */
    isDirectory(): boolean;

    /**
     * @returns The size of the file in bytes, or 0 if the object is not a regular file.
     */
    getFileSize(): number;

    /**
     * @returns The creation date formatted as "yyyy-MM-dd HH:mm:ss".
     */
    getCreatedDate(): string;

    /**
     * @returns The last modified date formatted as "yyyy-MM-dd HH:mm:ss".
     */
    getModifiedDate(): string;

    /**
     * @returns The last accessed date formatted as "yyyy-MM-dd".
     */
    getAccessedDate(): string;
  }

  /**
   * Represents information about a volume.
   */
  export type VolumeInfo = {
    /**
     * The type of the volume (e.g., "FAT12", "FAT16" or FAT32).
     */
    type: string;

    /**
     * The label or name assigned to the volume.
     */
    label: string;

    /**
     * The volume serial number.
     */
    id: number;

    /**
     * The size of a cluster on the volume in bytes.
     */
    clusterSize: number;

    /**
     * The amount of free space available on the volume in bytes.
     */
    freeSpace: number;
  };
}
