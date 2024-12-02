/**
 * @file Just to help TS to validate our JS files in IDE using JSDoc comments.
 */

/**
 * @see {@link file://./lm-externs.mjs}
 */
declare namespace lmNS {
  function mount(img: Uint8Array, options?: MountOptions): Disk;

  interface Encoding {
    decode(array: Uint8Array): string;
    encode(text: string): Uint8Array;
  }

  interface Disk {
    getFileSystem(): FileSystem | null;
    getPartitions(): Partition[];
  }

  interface FileSystem {
    getName(): string;
    getVolume(): Volume;
    getRoot(): File;
  }

  interface File {
    getName(): string;
    getShortName(): string;
    getAbsolutePath(): string;
    isRegularFile(): boolean;
    isDirectory(): boolean;
    length(): number;
    getSizeOnDisk(): number;
    lastModified(): Date | null;
    creationTime(): Date | null;
    lastAccessTime(): Date | null;
    findFirst(predicate: (f: File) => boolean): File | null;
    findAll(predicate: (f: File) => boolean): File[] | null;
    listFiles(): File[] | null;
    getData(): Uint8Array | null;
    setData(data: Uint8Array): File | null;
    delete(): void;
    getFile(relativePath: string): File | null;
    makeFile(relativePath: string): File | null;
    makeDir(relativePath: string): File | null;
    moveTo(dest: string): File | null;
  }

  interface Volume {
    getLabel(): string | null;
    setLabel(label: string | null): void;
    getOEMName(): string | null;
    setOEMName(oemName: string | null): void;
    getId(): number;
    setId(id: number): void;
    getSizeOfCluster(): number;
    getCountOfClusters(): number;
    getFreeClusters(): number;
  }

  type MountOptions = {
    encoding?: Encoding;
    partition?: Partition;
  };

  type Partition = {
    active: boolean;
    type: number;
    begin: number;
    end: number;
  };
}

type IIterableResult = { done: boolean; value: any };
