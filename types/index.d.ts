declare module "libmount" {
  export function mount(buf: !ArrayBuffer, encoding: string = "cp1251"): FileSystem;

  export interface File {
    getName(): string;
    getShortName(): string;
    getLongName(): string | null;
    getAbsolutePath(): string;
    isRegularFile(): boolean;
    isDirectory(): boolean;
    getFileSize(): number;
    getCreatedDate(): string;
    getModifiedDate(): string;
    getAccessedDate(): string;
  }

  export interface FileSystem {
    getVolumeInfo(): VolumeInfo;
    getRoot(): File;
    getFile(path: string): File | null;
    listFiles(file: File): Array<File>;
    readFile(file: File): Uint8Array | null;
    deleteFile(file: File): undefined;
  }

  export type VolumeInfo = {
    type: string;
    label: string;
    id: number;
    clusterSize: number;
    freeSpace: number;
  };
}
