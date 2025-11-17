/**
 * iconv-tiny v0.5.0
 * (c) 2025-present vip.delete
 * @license MIT
 **/


// src/const.mjs
var MAX_BYTE = 255;
var MAX_WORD = 65535;
var MAX_DOUBLE_WORD = 4294967295;
var SZ = 512;
var BS_JUMP_BOOT_LENGTH = 3;
var BS_OEM_NAME_LENGTH = 8;
var DIR_NAME_LENGTH = 11;
var BS_FIL_SYS_TYPE_LENGTH = 8;
var BPB_FAT32_RESERVED_LENGTH = 12;
var BS_BOOT_CODE_LENGTH = 448;
var BS_BOOT_CODE_FAT32_LENGTH = 420;
var BS_SIGNATURE_WORD = 43605;
var FSI_LEAD_SIG = 1096897106;
var FSI_STRUC_SIG = 1631679090;
var FSI_TRAIL_SIG = 2857697280;
var FSI_NEXT_FREE_OFFSET = 492;
var LFN_MAX_LEN = 255;
var LFN_NAME1_LENGTH = 10;
var LFN_NAME2_LENGTH = 12;
var LFN_NAME3_LENGTH = 4;
var LFN_ALL_NAMES_LENGTH = LFN_NAME1_LENGTH + LFN_NAME2_LENGTH + LFN_NAME3_LENGTH;
var LFN_BUFFER_LEN = 520;
var DIR_ENTRY_SIZE_BITS = 5;
var DIR_ENTRY_SIZE = 1 << DIR_ENTRY_SIZE_BITS;
var FAT_THRESHOLD = 4087;
var WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT12 = 0;
var WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT12 = 4085 - 1 - 6;
var WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT16 = FAT_THRESHOLD;
var WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT16 = 65525 - 1 - 6;
var WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT32 = 1;
var WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT32 = 268435445 - 1 - 6;
var COUNT_OF_CLUSTERS_COMPATIBILITY = 16;
var MIN_CLUS_NUM = 2;
var FREE_CLUS = 0;
var DIR_ENTRY_ATTR_VOLUME_ID = 8;
var DIR_ENTRY_ATTR_DIRECTORY = 16;
var DIR_ENTRY_ATTR_LFN = 15;
var DIR_ENTRY_FLAG_LAST = 0;
var DIR_ENTRY_FLAG_DELETED = 229;
var DIR_ENTRY_FLAG_E5 = 5;

// src/types.mjs
var ValidationError = class extends Error {
  /**
   * @param {string} [message]
   */
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
};

// src/utils.mjs
var ASSERTS_ENABLED = typeof USE_ASSERTS === "boolean" ? USE_ASSERTS : true;
var assert = (expression, msg) => {
  if (ASSERTS_ENABLED) {
    if (!expression) {
      throw new Error(msg ?? "AssertionError");
    }
  }
};
var str2bytes = (str) => new Uint8Array([...str].map((it) => it.charCodeAt(0)));
var SHORT_NAME_SPECIAL_CHARACTERS = str2bytes(" $%'-_@~`!(){}^#&");
var LONG_NAME_SPECIAL_CHARACTERS = str2bytes(".+,;=[]");
var isCapitalLetter = (code) => code > "A".charCodeAt(0) - 1 && code < "Z".charCodeAt(0) + 1;
var isSmallLetter = (code) => code > "a".charCodeAt(0) - 1 && code < "z".charCodeAt(0) + 1;
var isDigit = (code) => code > "0".charCodeAt(0) - 1 && code < "9".charCodeAt(0) + 1;
var isUnicode = (code) => code > 255;
var isExtended = (code) => code > 127;
var getChkSum = (sfn) => {
  assert(sfn.length === DIR_NAME_LENGTH);
  let sum = sfn[0];
  for (let i = 1, len = sfn.length; i < len; i++) {
    sum = (sum << 7 | sum >> 1) + sfn[i] & 255;
  }
  return sum;
};
var isShortNameValidCode = (code) => {
  assert(code >= 0 && code <= MAX_BYTE);
  return isExtended(code) || isCapitalLetter(code) || isDigit(code) || SHORT_NAME_SPECIAL_CHARACTERS.includes(code);
};
var isLongNameValidCode = (wcCode) => {
  assert(wcCode >= 0 && wcCode <= MAX_WORD);
  return isUnicode(wcCode) || isSmallLetter(wcCode) || isShortNameValidCode(wcCode) || LONG_NAME_SPECIAL_CHARACTERS.includes(wcCode);
};
var normalizeLongName = (longName) => {
  let i = 0;
  while (i < longName.length && longName.charCodeAt(i) === " ".charCodeAt(0)) {
    i++;
  }
  let j = longName.length - 1;
  let ch;
  while (j >= i && ((ch = longName.charCodeAt(j)) === " ".charCodeAt(0) || ch === ".".charCodeAt(0))) {
    j--;
  }
  return longName.slice(i, j + 1);
};
var split = (path) => {
  const names = [];
  const parts = path.split(/[/\\]/u);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part !== "" && part !== ".") {
      if (part === "..") {
        if (names.length) {
          names.length--;
        }
      } else {
        const name = normalizeLongName(part);
        if (name !== "") {
          names.push(name);
        }
      }
    }
  }
  return names;
};
var sfnToStr = (sfn, cp) => {
  assert(sfn.length === DIR_NAME_LENGTH);
  const str = cp.decode(sfn);
  const basename = str.slice(0, 8).trimEnd();
  const ext = str.slice(8, 11).trimEnd();
  return ext === "" ? basename : basename + "." + ext;
};
var appendToSFN = (sfn, offset, len, cp, str) => {
  if (str.startsWith(" ") || str.endsWith(" ")) {
    return false;
  }
  let i = 0;
  const buf = cp.encode(str);
  if (buf.length > len) {
    return false;
  }
  while (i < buf.length) {
    const code = buf[i];
    if (!isShortNameValidCode(code)) {
      return false;
    }
    sfn[offset + i] = code;
    i++;
  }
  while (i < len) {
    sfn[offset + i] = " ".charCodeAt(0);
    i++;
  }
  return true;
};
var strToSfn = (str, codepage) => {
  const i = str.lastIndexOf(".");
  const basename = i < 0 ? str : str.substring(0, i);
  const ext = i < 0 ? "" : str.substring(i + 1);
  if (basename === "" && ext === "") {
    return null;
  }
  const sfn = new Uint8Array(DIR_NAME_LENGTH);
  if (!appendToSFN(sfn, 0, 8, codepage, basename)) {
    return null;
  }
  if (!appendToSFN(sfn, 8, 3, codepage, ext)) {
    return null;
  }
  return sfn;
};
var LFN_BUFFER = new Uint8Array(LFN_BUFFER_LEN);
var strToLfn = (str) => {
  assert(str.length && str.length <= LFN_MAX_LEN);
  const lfn = LFN_BUFFER;
  let i = 0;
  let j = 0;
  while (i < str.length) {
    let ch = str.charCodeAt(i++);
    if (!isLongNameValidCode(ch)) {
      return null;
    }
    lfn[j++] = ch;
    ch >>= 8;
    lfn[j++] = ch;
  }
  if (j % LFN_ALL_NAMES_LENGTH !== 0) {
    lfn[j++] = 0;
    lfn[j++] = 0;
    while (j % LFN_ALL_NAMES_LENGTH !== 0) {
      lfn[j++] = MAX_BYTE;
      lfn[j++] = MAX_BYTE;
    }
  }
  assert(j <= lfn.length);
  return lfn.subarray(0, j);
};
var LFN_DECODE_BUFFER = new Uint16Array(LFN_BUFFER_LEN / 2);
var lfnToStr = (chain) => {
  assert(chain.length > 0);
  const buf = LFN_DECODE_BUFFER;
  let len = 0;
  let k = chain.length - 1;
  let ch;
  do {
    const item = chain[k--];
    const Name1 = item.Name1;
    let i = 0;
    while (i < LFN_NAME1_LENGTH && (ch = Name1[i++] | Name1[i++] << 8)) {
      buf[len++] = ch;
    }
    if (ch) {
      const Name2 = item.Name2;
      i = 0;
      while (i < LFN_NAME2_LENGTH && (ch = Name2[i++] | Name2[i++] << 8)) {
        buf[len++] = ch;
      }
      if (ch) {
        const Name3 = item.Name3;
        i = 0;
        while (i < LFN_NAME3_LENGTH && (ch = Name3[i++] | Name3[i++] << 8)) {
          buf[len++] = ch;
        }
      }
    }
  } while (ch && k >= 0);
  return String.fromCharCode(...buf.subarray(0, len));
};
var toValidShortNameCharacters = (str, max, cp) => {
  let ret = "";
  let i = 0;
  let count = 0;
  while (i < str.length && count < max) {
    const ch = str.charAt(i);
    if (ret !== "" || ch !== " ") {
      const buf = cp.encode(ch);
      const code = buf[0];
      if (code !== "?".charCodeAt(0)) {
        if (isShortNameValidCode(code)) {
          ret += ch;
          count += buf.length;
        } else {
          ret += "_";
          count++;
        }
      }
    }
    i++;
  }
  return ret;
};
var strToHash = (str) => {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum = sum + str.charCodeAt(i) & 65535;
  }
  return sum.toString(16).padStart(4, "0").toUpperCase();
};
var strToTildeName = (str, cp, fileNames) => {
  str = str.toUpperCase();
  const i = str.lastIndexOf(".");
  const basename = i < 0 ? str : str.substring(0, i);
  const ext = i < 0 ? "" : str.substring(i + 1);
  const basename6 = toValidShortNameCharacters(basename, 6, cp);
  const ext3 = toValidShortNameCharacters(ext, 3, cp);
  assert(!basename6.startsWith(" ") && basename6.length <= 6);
  assert(!ext3.startsWith(" ") && ext3.length <= 3);
  const prefix = basename6.length > 2 ? basename6 : basename6 + strToHash(str);
  const postfix = ext3 === "" ? "" : "." + ext3;
  let num = 1;
  let numLen = 1;
  while (numLen <= 7) {
    const filename = prefix.substring(0, 7 - numLen) + "~" + num + postfix;
    if (!fileNames.has(filename)) {
      return filename;
    }
    num++;
    numLen = num.toString().length;
  }
  return "";
};
var parseDate = (date) => {
  if (!date) {
    return null;
  }
  const dayOfMonth = date & 31;
  const monthOfYear = date >> 5 & 15;
  const yearSince1980 = date >> 9 & 127;
  return new Date(1980 + yearSince1980, Math.max(0, monthOfYear - 1), Math.max(1, dayOfMonth));
};
var parseDateTime = (date, time, timeTenth) => {
  if (!date) {
    return null;
  }
  const dayOfMonth = date & 31;
  const monthOfYear = date >> 5 & 15;
  const yearSince1980 = date >> 9 & 127;
  const millis = timeTenth % 100 * 10;
  const seconds = Math.floor(timeTenth / 100) + ((time & 31) << 1);
  const minutes = time >> 5 & 63;
  const hours = time >> 11 & 31;
  return new Date(1980 + yearSince1980, Math.max(0, monthOfYear - 1), Math.max(1, dayOfMonth), hours, minutes, seconds, millis);
};
var toDate = (date) => {
  if (!date) {
    return 0;
  }
  const yearSince1980 = date.getFullYear() - 1980;
  const monthOfYear = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  return yearSince1980 << 9 | monthOfYear << 5 | dayOfMonth;
};
var toTime = (date) => {
  if (!date) {
    return 0;
  }
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return hours << 11 | minutes << 5 | seconds >> 1;
};
var toTimeTenth = (date) => {
  if (!date) {
    return 0;
  }
  const seconds = date.getSeconds();
  const millis = date.getMilliseconds();
  return Math.floor((seconds % 2 * 1e3 + Number(millis)) / 10);
};
var strToUint8Array = (cp, len, str) => {
  const data = new Uint8Array(len).fill(" ".charCodeAt(0));
  if (str) {
    data.set(cp.encode(str.substring(0, len)).subarray(0, len));
  }
  return data;
};

// src/dao.mjs
var validate = (expression) => {
  if (!expression) {
    throw new ValidationError();
  }
};
var loadCHS = (io) => {
  const b1 = io.readByte();
  const b2 = io.readByte();
  const b3 = io.readByte();
  return {
    Cylinder: b2 >> 6 << 8 | b3,
    Head: b1,
    Sector: b2 & 63
  };
};
var writeCHS = (io, chs) => {
  const b1 = chs.Head;
  const b2 = chs.Cylinder >> 8 << 6 | chs.Sector & 63;
  const b3 = chs.Cylinder & 255;
  io.writeByte(b1).writeByte(b2).writeByte(b3);
};
var loadPartitionTable = (io) => {
  validate(io.len() >= 512);
  io.seek(510 - 16 * 4);
  const table = [];
  for (let i = 0; i < 4; i++) {
    let partition = {
      BootIndicator: io.readByte(),
      Starting: loadCHS(io),
      SystemID: io.readByte(),
      Ending: loadCHS(io),
      RelativeSectors: io.readDoubleWord(),
      TotalSectors: io.readDoubleWord()
    };
    try {
      validate(partition.SystemID > 0);
      validate([0, 128].includes(partition.BootIndicator));
      validate(partition.TotalSectors > 0);
    } catch {
      partition = null;
    }
    if (partition) {
      table.push(partition);
    }
  }
  return table;
};
var writePartitionTable = (io, partitions) => {
  io.seek(510 - 4 * 16);
  let i = 0;
  while (i < 4 && i < partitions.length) {
    const e = partitions[i];
    io.writeByte(e.BootIndicator);
    writeCHS(io, e.Starting);
    io.writeByte(e.SystemID);
    writeCHS(io, e.Ending);
    io.writeDoubleWord(e.RelativeSectors);
    io.writeDoubleWord(e.TotalSectors);
    i++;
  }
  io.writeBytes(0, (4 - i) * 16);
  io.writeWord(BS_SIGNATURE_WORD);
};
var isBpbFat32 = (bpb) => bpb.FATSz16 === 0;
var loadBootSector = (io) => {
  validate(io.len() >= 512);
  io.seek(0);
  const jmpBoot = io.readUint8Array(BS_JUMP_BOOT_LENGTH);
  const OEMName = io.readUint8Array(BS_OEM_NAME_LENGTH);
  const bpb = {
    BytsPerSec: io.readWord(),
    SecPerClus: io.readByte(),
    RsvdSecCnt: io.readWord(),
    NumFATs: io.readByte(),
    RootEntCnt: io.readWord(),
    TotSec16: io.readWord(),
    Media: io.readByte(),
    FATSz16: io.readWord(),
    SecPerTrk: io.readWord(),
    NumHeads: io.readWord(),
    HiddSec: io.readDoubleWord(),
    TotSec32: io.readDoubleWord(),
    // FAT32 specific fields
    FATSz32: -1,
    ExtFlags: -1,
    FSVer: -1,
    RootClus: -1,
    FSInfo: -1,
    BkBootSec: -1
  };
  validate([512, 1024, 2048, 4096].includes(bpb.BytsPerSec));
  validate([1, 2, 4, 8, 16, 32, 64, 128].includes(bpb.SecPerClus));
  validate(bpb.RsvdSecCnt > 0);
  validate(bpb.NumFATs > 0);
  validate((bpb.RootEntCnt << DIR_ENTRY_SIZE_BITS) % bpb.BytsPerSec === 0);
  validate(bpb.RootEntCnt === 0 || bpb.FATSz16 > 0);
  validate(bpb.TotSec16 > 0 || bpb.TotSec32 > MAX_WORD);
  if (isBpbFat32(bpb)) {
    bpb.FATSz32 = io.readDoubleWord();
    bpb.ExtFlags = io.readWord();
    bpb.FSVer = io.readWord();
    bpb.RootClus = io.readDoubleWord();
    bpb.FSInfo = io.readWord();
    bpb.BkBootSec = io.readWord();
    io.skip(BPB_FAT32_RESERVED_LENGTH);
    validate(bpb.RootClus >= MIN_CLUS_NUM);
    validate(bpb.BkBootSec >= 0);
    validate(bpb.FSInfo > 0);
  }
  const bs = {
    jmpBoot,
    OEMName,
    bpb,
    DrvNum: io.readByte(),
    Reserved1: io.readByte(),
    BootSig: io.readByte(),
    VolID: io.readDoubleWord(),
    VolLab: io.readUint8Array(DIR_NAME_LENGTH),
    FilSysType: io.readUint8Array(BS_FIL_SYS_TYPE_LENGTH),
    BootCode: io.readUint8Array(510 - io.pos())
  };
  return bs;
};
var writeBootSector = (io, bs) => {
  io.seek(0);
  const { bpb } = bs;
  const bpbFat32 = isBpbFat32(bpb);
  assert(bs.jmpBoot.length === BS_JUMP_BOOT_LENGTH);
  assert(bs.OEMName.length === BS_OEM_NAME_LENGTH);
  assert(bs.VolLab.length === DIR_NAME_LENGTH);
  assert(bs.FilSysType.length === BS_FIL_SYS_TYPE_LENGTH);
  assert(bs.BootCode.length === (bpbFat32 ? BS_BOOT_CODE_FAT32_LENGTH : BS_BOOT_CODE_LENGTH));
  io.writeUint8Array(bs.jmpBoot).writeUint8Array(bs.OEMName).writeWord(bpb.BytsPerSec).writeByte(bpb.SecPerClus).writeWord(bpb.RsvdSecCnt).writeByte(bpb.NumFATs).writeWord(bpb.RootEntCnt).writeWord(bpb.TotSec16).writeByte(bpb.Media).writeWord(bpb.FATSz16).writeWord(bpb.SecPerTrk).writeWord(bpb.NumHeads).writeDoubleWord(bpb.HiddSec).writeDoubleWord(bpb.TotSec32);
  if (bpbFat32) {
    io.writeDoubleWord(bpb.FATSz32).writeWord(bpb.ExtFlags).writeWord(bpb.FSVer).writeDoubleWord(bpb.RootClus).writeWord(bpb.FSInfo).writeWord(bpb.BkBootSec).skip(BPB_FAT32_RESERVED_LENGTH);
  }
  io.writeByte(bs.DrvNum).writeByte(bs.Reserved1).writeByte(bs.BootSig).writeDoubleWord(bs.VolID).writeUint8Array(bs.VolLab).writeUint8Array(bs.FilSysType).writeUint8Array(bs.BootCode).writeWord(BS_SIGNATURE_WORD);
  assert(io.pos() === 512);
};
var loadFSI = (io) => {
  const LeadSig = io.readDoubleWord();
  const StrucSig = io.skip(480).readDoubleWord();
  const FreeCount = io.readDoubleWord();
  const NxtFree = io.readDoubleWord();
  const TrailSig = io.skip(12).readDoubleWord();
  validate(LeadSig === FSI_LEAD_SIG && StrucSig === FSI_STRUC_SIG && TrailSig === FSI_TRAIL_SIG);
  return {
    FreeCount,
    NxtFree
  };
};
var writeFSI = (io, fsInfo) => {
  io.writeDoubleWord(FSI_LEAD_SIG).writeBytes(0, 480).writeDoubleWord(FSI_STRUC_SIG).writeDoubleWord(fsInfo.FreeCount).writeDoubleWord(fsInfo.NxtFree).writeBytes(0, 12).writeDoubleWord(FSI_TRAIL_SIG);
};
var isDirEntryLFN = (io) => {
  const flag = io.skip(DIR_NAME_LENGTH).readByte() === DIR_ENTRY_ATTR_LFN;
  io.skip(-DIR_NAME_LENGTH - 1);
  return flag;
};
var readDirEntry = (io) => ({
  Name: io.readUint8Array(DIR_NAME_LENGTH),
  Attributes: io.readByte(),
  NTRes: io.readByte(),
  CrtTimeTenth: io.readByte(),
  CrtTime: io.readWord(),
  CrtDate: io.readWord(),
  LstAccDate: io.readWord(),
  FstClusHI: io.readWord(),
  WrtTime: io.readWord(),
  WrtDate: io.readWord(),
  FstClusLO: io.readWord(),
  FileSize: io.readDoubleWord()
});
var loadDirEntry = (io) => {
  const dir = readDirEntry(io);
  if (dir.Name[0] === DIR_ENTRY_FLAG_E5) {
    dir.Name[0] = DIR_ENTRY_FLAG_DELETED;
  }
  return dir;
};
var writeDirEntry = (io, offset, dirEntry) => {
  assert(dirEntry.Name.length === DIR_NAME_LENGTH);
  if (dirEntry.Name[0] === DIR_ENTRY_FLAG_DELETED) {
    dirEntry.Name[0] = DIR_ENTRY_FLAG_E5;
  }
  io.seek(offset).writeUint8Array(dirEntry.Name).writeByte(dirEntry.Attributes).writeByte(dirEntry.NTRes).writeByte(dirEntry.CrtTimeTenth).writeWord(dirEntry.CrtTime).writeWord(dirEntry.CrtDate).writeWord(dirEntry.LstAccDate).writeWord(dirEntry.FstClusHI).writeWord(dirEntry.WrtTime).writeWord(dirEntry.WrtDate).writeWord(dirEntry.FstClusLO).writeDoubleWord(dirEntry.FileSize);
};
var writeDirEntryLFN = (io, offset, dir) => {
  assert(dir.Name1.length === LFN_NAME1_LENGTH);
  assert(dir.Name2.length === LFN_NAME2_LENGTH);
  assert(dir.Name3.length === LFN_NAME3_LENGTH);
  io.seek(offset).writeByte(dir.Ord).writeUint8Array(dir.Name1).writeByte(dir.Attributes).writeByte(dir.Type).writeByte(dir.Chksum).writeUint8Array(dir.Name2).writeWord(dir.FstClusLO).writeUint8Array(dir.Name3);
};
var loadDirEntryLFN = (io) => ({
  Ord: io.readByte(),
  Name1: io.readUint8Array(LFN_NAME1_LENGTH),
  Attributes: io.readByte(),
  Type: io.readByte(),
  Chksum: io.readByte(),
  Name2: io.readUint8Array(LFN_NAME2_LENGTH),
  FstClusLO: io.readWord(),
  Name3: io.readUint8Array(LFN_NAME3_LENGTH)
});
var createVolumeDirEntry = (sfn) => {
  const now = /* @__PURE__ */ new Date();
  return {
    Name: sfn,
    Attributes: DIR_ENTRY_ATTR_VOLUME_ID,
    NTRes: 0,
    CrtTimeTenth: 0,
    CrtTime: 0,
    CrtDate: 0,
    LstAccDate: 0,
    FstClusHI: 0,
    WrtTime: toTime(now),
    WrtDate: toDate(now),
    FstClusLO: 0,
    FileSize: 0
  };
};
var createDotDirEntry = (sfn, dir) => ({
  Name: sfn,
  Attributes: DIR_ENTRY_ATTR_DIRECTORY,
  NTRes: 0,
  CrtTimeTenth: dir.CrtTimeTenth,
  CrtTime: dir.CrtTime,
  CrtDate: dir.CrtDate,
  LstAccDate: dir.LstAccDate,
  FstClusHI: dir.FstClusHI,
  WrtTime: dir.WrtTime,
  WrtDate: dir.WrtDate,
  FstClusLO: dir.FstClusLO,
  FileSize: 0
});
var createDirEntry = (Name, dateTime) => {
  const date = toDate(dateTime);
  const time = toTime(dateTime);
  const timeTenth = toTimeTenth(dateTime);
  return {
    Name,
    Attributes: 0,
    NTRes: 0,
    CrtTimeTenth: timeTenth,
    CrtTime: time,
    CrtDate: date,
    LstAccDate: date,
    FstClusHI: 0,
    WrtTime: time,
    WrtDate: date,
    FstClusLO: 0,
    FileSize: 0
  };
};

// src/io.mjs
var DriverIO = class {
  /**
   * @param {!ns.RandomAccessDriver} driver
   */
  constructor(driver) {
    this.driver = driver;
  }
  // Driver
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  len() {
    return this.driver.capacity;
  }
  /**
   * @override
   * @param {number} address
   * @param {number} len
   * @return {!Uint8Array}
   */
  // @ts-expect-error
  readUint8Array(address, len) {
    assert(address + len <= this.driver.capacity);
    return this.driver.read(address, len);
  }
  /**
   * @override
   * @param {number} address
   * @return {number}
   */
  // @ts-expect-error
  readByte(address) {
    return this.readUint8Array(address, 1)[0];
  }
  /**
   * @override
   * @param {number} address
   * @return {number}
   */
  // @ts-expect-error
  readWord(address) {
    const array = this.readUint8Array(address, 2);
    const k = array[0] | array[1] << 8;
    return k;
  }
  /**
   * @override
   * @param {number} address
   * @return {number}
   */
  // @ts-expect-error
  readDoubleWord(address) {
    const array = this.readUint8Array(address, 4);
    const k = (array[0] | array[1] << 8 | array[2] << 16 | array[3] << 24) >>> 0;
    return k;
  }
  /**
   * @override
   * @param {number} address
   * @param {!Uint8Array} array
   */
  // @ts-expect-error
  writeUint8Array(address, array) {
    assert(address + array.length <= this.driver.capacity);
    this.driver.write?.(address, array);
  }
  /**
   * @override
   * @param {number} address
   * @param {number} data
   */
  // @ts-expect-error
  writeByte(address, data) {
    this.writeUint8Array(address, new Uint8Array([data]));
  }
  /**
   * @override
   * @param {number} address
   * @param {number} data
   * @param {number} count
   */
  // @ts-expect-error
  writeBytes(address, data, count) {
    this.writeUint8Array(address, new Uint8Array(count).fill(data));
  }
  /**
   * @override
   * @param {number} address
   * @param {number} data
   */
  // @ts-expect-error
  writeWord(address, data) {
    this.writeUint8Array(address, new Uint8Array([data, data >>> 8]));
  }
  /**
   * @override
   * @param {number} address
   * @param {number} data
   */
  // @ts-expect-error
  writeDoubleWord(address, data) {
    this.writeUint8Array(address, new Uint8Array([data, data >>> 8, data >>> 16, data >>> 24]));
  }
};
var SyncIO = class {
  /**
   * @param {!Uint8Array} array
   */
  constructor(array) {
    this.array = array;
    this.i = 0;
  }
  // IO
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  pos() {
    return this.i;
  }
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  len() {
    return this.array.length;
  }
  /**
   * @override
   * @param {number} offset
   * @return {!IO}
   */
  // @ts-expect-error
  seek(offset) {
    this.i = offset;
    return this;
  }
  /**
   * @override
   * @param {number} bytes
   * @return {!IO}
   */
  // @ts-expect-error
  skip(bytes) {
    this.i += bytes;
    return this;
  }
  /**
   * @override
   * @param {number} len
   * @return {!Uint8Array}
   */
  // @ts-expect-error
  readUint8Array(len) {
    assert(this.i + len <= this.array.length);
    const k = new Uint8Array(this.array.subarray(this.i, this.i += len));
    return k;
  }
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  readByte() {
    assert(this.i < this.array.length);
    return this.array[this.i++];
  }
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  readWord() {
    const { array } = this;
    assert(this.i + 2 <= array.length);
    const k = array[this.i++] | array[this.i++] << 8;
    return k;
  }
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  readDoubleWord() {
    const { array } = this;
    assert(this.i + 4 <= array.length);
    const k = (array[this.i++] | array[this.i++] << 8 | array[this.i++] << 16 | array[this.i++] << 24) >>> 0;
    return k;
  }
  /**
   * @override
   * @param {!Uint8Array} array
   * @return {!IO}
   */
  // @ts-expect-error
  writeUint8Array(array) {
    assert(this.i + array.length <= this.array.length);
    this.array.set(array, this.i);
    this.i += array.length;
    return this;
  }
  /**
   * @override
   * @param {number} data
   * @return {!IO}
   */
  // @ts-expect-error
  writeByte(data) {
    assert(this.i + 1 <= this.array.length);
    assert(data >= 0 && data <= MAX_BYTE);
    this.array[this.i++] = data;
    return this;
  }
  /**
   * @override
   * @param {number} data
   * @param {number} count
   * @return {!IO}
   */
  // @ts-expect-error
  writeBytes(data, count) {
    assert(count >= 0);
    assert(this.i + count <= this.array.length);
    assert(data >= 0 && data <= MAX_BYTE);
    this.array.fill(data, this.i, this.i += count);
    return this;
  }
  /**
   * @override
   * @param {number} data
   * @return {!IO}
   */
  // @ts-expect-error
  writeWord(data) {
    const { array } = this;
    assert(this.i + 2 <= array.length);
    assert(data >= 0 && data <= MAX_WORD);
    array[this.i++] = data;
    data >>>= 8;
    array[this.i++] = data;
    return this;
  }
  /**
   * @override
   * @param {number} data
   * @return {!IO}
   */
  // @ts-expect-error
  writeDoubleWord(data) {
    const { array } = this;
    assert(this.i + 4 <= array.length);
    assert(data >= 0 && data <= MAX_DOUBLE_WORD);
    array[this.i++] = data;
    data >>>= 8;
    array[this.i++] = data;
    data >>>= 8;
    array[this.i++] = data;
    data >>>= 8;
    array[this.i++] = data;
    return this;
  }
};
var createDriver = (driver) => new DriverIO(driver);
var createIO = (array) => new SyncIO(array);

// src/fdisk.mjs
var fdisk = (partitions) => {
  const bs = new Uint8Array(512);
  writePartitionTable(
    createIO(bs),
    partitions.map(({ active, type, relativeSectors, totalSectors }) => {
      const noCHS = { Cylinder: 0, Head: 0, Sector: 0 };
      return {
        BootIndicator: active ? 128 : 0,
        Starting: noCHS,
        SystemID: type,
        Ending: noCHS,
        RelativeSectors: relativeSectors,
        TotalSectors: totalSectors
      };
    })
  );
  return {
    bytsPerSec: 512,
    zeroRegions: [],
    dataSectors: [{ i: 0, data: bs }]
  };
};

// src/bs.mjs
var jmpBoot12 = [235, 60, 144];
var jmpBoot32 = [235, 88, 144];
var BootCode12 = str2bytes("¾V|´¬ÀtÍë÷1ÀÍÍëþ");
var BootCode32 = str2bytes("¾r|´¬ÀtÍë÷1ÀÍÍëþ");

// src/mkfsvfat.mjs
var BYTES_PER_SECTOR_BITS = 9;
var MAX_RECOMMENDED_BYTES_PER_CLUSTER_BITS = 15;
var OEM_NAME = str2bytes("LIBMNTJS");
var BOOT_ERROR_MESSAGE = str2bytes("Non-system disk or disk error\r\nreplace and strike any key when ready\r\n");
var MIN_RESERVED_SECTOR_COUNT = 1;
var MIN_RESERVED_SECTOR_COUNT_FAT32 = 32;
var FAT12 = 12;
var FAT16 = 16;
var FAT32 = 32;
var NO_NAME_SFN = str2bytes("NO NAME    ");
var FLOPPY_FORMATS = /* @__PURE__ */ new Map([
  // capacity: Media, Tracks, NumHeads, SecPerTrk, SecPerClusBits, FATSz, RootDirSectors
  [160, [254, 40, 1, 8, 0, 1, 4]],
  [180, [252, 40, 1, 9, 0, 2, 4]],
  [320, [255, 40, 2, 8, 1, 1, 7]],
  [360, [253, 40, 2, 9, 1, 2, 7]],
  [720, [249, 80, 2, 9, 1, 3, 7]],
  [1200, [249, 80, 2, 15, 0, 7, 14]],
  [1440, [240, 80, 2, 18, 0, 9, 14]],
  [2880, [240, 80, 2, 36, 1, 9, 15]]
]);
var getIndexBits = (capacity, type) => {
  let IndexBits = FAT32;
  if (type === "FAT12") {
    IndexBits = FAT12;
  } else if (type === "FAT16") {
    IndexBits = FAT16;
  } else if (type === "FAT32") {
    IndexBits = FAT32;
  } else if (capacity <= /* 4 MB */
  4 << 20) {
    IndexBits = FAT12;
  } else if (capacity < /* 512 MB */
  512 << 20) {
    IndexBits = FAT16;
  }
  return IndexBits;
};
var getIntegerOrDefault = (min, max, defaultValue, value) => {
  if (Number.isInteger(value)) {
    value = Number(value);
    if (value >= min && value <= max) {
      return value;
    }
  }
  return defaultValue;
};
var getDefaultVolID = () => {
  const now = /* @__PURE__ */ new Date();
  return (toDate(now) << 16 | toTime(now)) >>> 0;
};
var getMinFATSz = (CountOfClusters, IndexBits, BytsPerSecBits) => {
  assert(CountOfClusters >= 0);
  assert(BytsPerSecBits >= 9);
  assert(IndexBits === FAT12 || IndexBits === FAT16 || IndexBits === FAT32);
  const OriginalMinFATSz = Math.ceil((CountOfClusters + 2) * IndexBits / (1 << BytsPerSecBits + 3));
  let Dividend = CountOfClusters + 2;
  assert(Dividend <= 268435455);
  let DivisorShift = BytsPerSecBits + 3;
  if (IndexBits === FAT32) {
    DivisorShift -= 5;
  } else if (IndexBits === FAT16) {
    DivisorShift -= 4;
  } else {
    Dividend *= 3;
    DivisorShift -= 2;
  }
  assert(Dividend <= 1073741823);
  assert(DivisorShift > 0);
  const Quotient = Dividend >>> DivisorShift;
  const Reminder = Dividend & (1 << DivisorShift) - 1;
  const MinFATSz = Quotient + (Reminder === 0 ? 0 : 1);
  assert(MinFATSz === OriginalMinFATSz);
  return MinFATSz;
};
var getSecPerClusBits = (IndexBits, DskSz, MaxClusCntSafe, BytsPerSecBits, DataAndFAT, NumFATs, secPerClus) => {
  if (Number.isInteger(secPerClus)) {
    const i = [1, 2, 4, 8, 16, 32, 64, 128].indexOf(Number(secPerClus));
    if (i >= 0) {
      return i;
    }
  }
  if (IndexBits === FAT32) {
    if (DskSz <= 260 << 11) {
      return 0;
    }
    return 3;
  }
  const MaxFATSz = getMinFATSz(MaxClusCntSafe, IndexBits, BytsPerSecBits);
  const MinDataSec = DataAndFAT - NumFATs * MaxFATSz;
  const MaxSecPerClusBits = MAX_RECOMMENDED_BYTES_PER_CLUSTER_BITS - BytsPerSecBits;
  let SecPerClusBits = 0;
  let MaxDataSec = MaxClusCntSafe;
  while (SecPerClusBits < MaxSecPerClusBits && MaxDataSec < MinDataSec) {
    SecPerClusBits++;
    MaxDataSec *= 2;
  }
  return SecPerClusBits;
};
var getOptimalFATSz = (DataAndFAT, NumFATs, SecPerClusBits, IndexBits, BytsPerSecBits) => {
  const Numerator = DataAndFAT + (1 << SecPerClusBits + 1);
  const Denominator = (1 << SecPerClusBits + BytsPerSecBits + 3) / IndexBits + NumFATs;
  return Math.ceil(Numerator / Denominator);
};
var getRootDirSectors = (BytsPerSecBits, rootEntCnt) => {
  const RootEntCnt = getIntegerOrDefault(1, 512, 512, rootEntCnt);
  const RootEntPerSecBits = BytsPerSecBits - DIR_ENTRY_SIZE_BITS;
  return (RootEntCnt >> RootEntPerSecBits) + ((RootEntCnt & (1 << RootEntPerSecBits) - 1) === 0 ? 0 : 1);
};
var createFloppyDiskLayout = (capacity, floppyFormat) => {
  const [Media, Tracks, NumHeads, SecPerTrk, SecPerClusBits, FATSz, RootDirSectors] = floppyFormat;
  const BytsPerSecBits = 9;
  const TotSec = Tracks * NumHeads * SecPerTrk;
  assert(TotSec << BytsPerSecBits === capacity);
  const RsvdSecCnt = 1;
  const NumFATs = 2;
  const MetaSec = RsvdSecCnt + FATSz * NumFATs + RootDirSectors;
  assert(MetaSec % (1 << SecPerClusBits) === 0);
  const DataSec = TotSec - MetaSec;
  const CountOfClusters = DataSec >> SecPerClusBits;
  return {
    IndexBits: FAT12,
    BytsPerSecBits,
    SecPerClusBits,
    RsvdSecCnt,
    NumFATs,
    RootDirSectors,
    FATSz,
    TotSec,
    CountOfClusters,
    Media,
    NumHeads,
    SecPerTrk
  };
};
var createDiskLayout = (capacity, options) => {
  const maxCapacity = Number.MAX_SAFE_INTEGER;
  capacity = getIntegerOrDefault(0, maxCapacity, maxCapacity, capacity);
  const IndexBits = getIndexBits(capacity, options?.type);
  const BytsPerSecBits = BYTES_PER_SECTOR_BITS;
  const BytsPerSec = 1 << BytsPerSecBits;
  const DskSz = Math.min(MAX_DOUBLE_WORD, Math.floor(capacity / BytsPerSec));
  const NumFATs = options?.numFATs === 1 ? 1 : 2;
  let RootDirSectors = 0;
  let RsvdSecCnt = MIN_RESERVED_SECTOR_COUNT_FAT32;
  if (IndexBits !== FAT32) {
    RootDirSectors = getRootDirSectors(BytsPerSecBits, options?.rootEntCnt);
    RsvdSecCnt = MIN_RESERVED_SECTOR_COUNT;
  }
  let MinClusCntSafe = WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT32;
  let MaxClusCntSafe = WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT32;
  if (IndexBits === FAT12) {
    MinClusCntSafe = WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT12;
    MaxClusCntSafe = WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT12;
  } else if (IndexBits === FAT16) {
    MinClusCntSafe = WINDOWS_MIN_COUNT_OF_CLUSTERS_FAT16;
    MaxClusCntSafe = WINDOWS_MAX_COUNT_OF_CLUSTERS_FAT16;
  }
  const DataAndFAT = DskSz - RsvdSecCnt - RootDirSectors;
  if (DataAndFAT < NumFATs) {
    return null;
  }
  const compat = getIntegerOrDefault(0, COUNT_OF_CLUSTERS_COMPATIBILITY, COUNT_OF_CLUSTERS_COMPATIBILITY, options?.compat);
  MinClusCntSafe += compat;
  MaxClusCntSafe -= compat;
  const SecPerClusBits = getSecPerClusBits(IndexBits, DskSz, MaxClusCntSafe, BytsPerSecBits, DataAndFAT, NumFATs, options?.secPerClus);
  const SecPerClus = 1 << SecPerClusBits;
  let FATSz = getOptimalFATSz(DataAndFAT, NumFATs, SecPerClusBits, IndexBits, BytsPerSecBits);
  let DataSec = DataAndFAT - FATSz * NumFATs;
  let CountOfClusters = Math.floor(DataSec / SecPerClus);
  if (CountOfClusters < MinClusCntSafe) {
    return null;
  }
  if (CountOfClusters > MaxClusCntSafe) {
    CountOfClusters = MaxClusCntSafe;
  }
  FATSz = getMinFATSz(CountOfClusters, IndexBits, BytsPerSecBits);
  let MetaSec = RsvdSecCnt + FATSz * NumFATs + RootDirSectors;
  DataSec = CountOfClusters * SecPerClus;
  let TotSec = MetaSec + DataSec;
  let Wasted = DskSz - TotSec;
  assert(Wasted >= 0);
  const Reminder = MetaSec % SecPerClus;
  const Alignment = Reminder === 0 ? 0 : SecPerClus - Reminder;
  let AlignmentAdjustment = 0;
  if (Alignment > Wasted) {
    CountOfClusters--;
    Wasted += SecPerClus;
    if (CountOfClusters < MinClusCntSafe) {
      return null;
    }
    const NewFATSz = getMinFATSz(CountOfClusters, IndexBits, BytsPerSecBits);
    AlignmentAdjustment = (FATSz - NewFATSz) * NumFATs;
    assert(AlignmentAdjustment >= 0);
    FATSz = NewFATSz;
  }
  Wasted -= Alignment;
  assert(Wasted >= 0);
  RsvdSecCnt += Alignment + AlignmentAdjustment;
  TotSec = DskSz - Wasted;
  assert(TotSec <= MAX_DOUBLE_WORD);
  MetaSec = RsvdSecCnt + FATSz * NumFATs + RootDirSectors;
  DataSec = CountOfClusters * SecPerClus;
  assert(MetaSec % SecPerClus === 0);
  assert(TotSec === MetaSec + DataSec);
  return {
    IndexBits,
    BytsPerSecBits,
    SecPerClusBits,
    RsvdSecCnt,
    NumFATs,
    RootDirSectors,
    FATSz,
    TotSec,
    CountOfClusters,
    Media: 248,
    NumHeads: 255,
    SecPerTrk: 63
  };
};
var createBootSector = (diskLayout, options) => {
  const { IndexBits, BytsPerSecBits, SecPerClusBits, RsvdSecCnt, NumFATs, RootDirSectors, FATSz, TotSec } = diskLayout;
  const bpbFat32 = IndexBits === FAT32;
  const BootCodeLength = bpbFat32 ? BS_BOOT_CODE_FAT32_LENGTH : BS_BOOT_CODE_LENGTH;
  const BytsPerSec = 1 << BytsPerSecBits;
  const RootEntCnt = RootDirSectors << BytsPerSecBits - DIR_ENTRY_SIZE_BITS;
  const bootSector = {
    jmpBoot: new Uint8Array(BS_JUMP_BOOT_LENGTH),
    OEMName: new Uint8Array(BS_OEM_NAME_LENGTH).fill(" ".charCodeAt(0)),
    bpb: {
      BytsPerSec,
      SecPerClus: 1 << SecPerClusBits,
      RsvdSecCnt,
      NumFATs,
      RootEntCnt,
      TotSec16: TotSec > MAX_WORD ? 0 : TotSec,
      Media: getIntegerOrDefault(0, MAX_BYTE, diskLayout.Media, options?.media),
      FATSz16: bpbFat32 ? 0 : FATSz,
      SecPerTrk: getIntegerOrDefault(0, MAX_WORD, diskLayout.SecPerTrk, options?.secPerTrk),
      NumHeads: getIntegerOrDefault(0, MAX_WORD, diskLayout.NumHeads, options?.numHeads),
      HiddSec: getIntegerOrDefault(0, MAX_DOUBLE_WORD, 0, options?.hiddSec),
      TotSec32: TotSec > MAX_WORD ? TotSec : 0,
      FATSz32: FATSz,
      ExtFlags: 0,
      FSVer: 0,
      RootClus: 2,
      FSInfo: 1,
      BkBootSec: 6
    },
    DrvNum: 0,
    Reserved1: 0,
    BootSig: 41,
    VolID: getIntegerOrDefault(0, MAX_DOUBLE_WORD, getDefaultVolID(), options?.id),
    VolLab: NO_NAME_SFN,
    FilSysType: new Uint8Array(BS_FIL_SYS_TYPE_LENGTH).fill(" ".charCodeAt(0)),
    BootCode: new Uint8Array(BootCodeLength)
  };
  bootSector.OEMName.set((options?.oemName ?? OEM_NAME).subarray(0, BS_OEM_NAME_LENGTH));
  bootSector.FilSysType.set(str2bytes("FAT" + IndexBits));
  const bs = options?.bs;
  if (bs && bs.length >= 512) {
    bootSector.jmpBoot.set(bs.subarray(0, BS_JUMP_BOOT_LENGTH));
    bootSector.BootCode.set(bs.subarray(510 - BootCodeLength, 510));
  } else {
    let jmpBoot = jmpBoot12;
    let BootCode = BootCode12;
    const BootCodeOffset = 510 - BootCodeLength;
    if (bpbFat32) {
      jmpBoot = jmpBoot32;
      BootCode = BootCode32;
    }
    bootSector.jmpBoot.set(jmpBoot);
    bootSector.BootCode.set(BootCode);
    const message = options?.message ?? BOOT_ERROR_MESSAGE;
    const maxMessageLength = 510 - 1 - BootCodeOffset - BootCode.length;
    bootSector.BootCode.set(message.subarray(0, maxMessageLength), BootCode.length);
  }
  return bootSector;
};
var createDiskSectors = (IndexBits, bootSector, options) => {
  const bpb = bootSector.bpb;
  const { BytsPerSec, SecPerClus, RsvdSecCnt, NumFATs, RootEntCnt, TotSec16, Media, FATSz16, TotSec32, FATSz32 } = bpb;
  const bpbFat32 = IndexBits === FAT32;
  const RootDirSectors = bpbFat32 ? 0 : Math.ceil((RootEntCnt << DIR_ENTRY_SIZE_BITS) / BytsPerSec);
  const FATSz = bpbFat32 ? FATSz32 : FATSz16;
  const TotSec = TotSec16 ? TotSec16 : TotSec32;
  const MetaSec = RsvdSecCnt + FATSz * NumFATs + RootDirSectors;
  const DataSec = TotSec - MetaSec;
  const CountOfClusters = Math.floor(DataSec / SecPerClus);
  const zeroRegions = [];
  zeroRegions.push({ i: 0, count: MetaSec + (bpbFat32 ? SecPerClus : 0) });
  const dataSectors = [];
  const bs = new Uint8Array(BytsPerSec);
  writeBootSector(createIO(bs), bootSector);
  dataSectors.push({ i: 0, data: bs });
  const fat = new Uint8Array(BytsPerSec);
  fat[0] = Media;
  for (let j = 0; j < IndexBits / 4 - 1; j++) {
    fat[j + 1] = 255;
  }
  if (bpbFat32) {
    const { RootClus, FSInfo, BkBootSec } = bpb;
    const offset = RootClus * 4;
    fat[offset] = 255;
    fat[offset + 1] = 255;
    fat[offset + 2] = 255;
    fat[offset + 3] = 15;
    const fsi = new Uint8Array(BytsPerSec);
    writeFSI(createIO(fsi), { FreeCount: CountOfClusters - 1, NxtFree: MIN_CLUS_NUM });
    dataSectors.push({ i: FSInfo, data: fsi });
    dataSectors.push({ i: BkBootSec, data: bs });
    dataSectors.push({ i: BkBootSec + 1, data: fsi });
  }
  for (let i = 0; i < NumFATs; i++) {
    const offset = RsvdSecCnt + i * FATSz;
    dataSectors.push({ i: offset, data: fat });
  }
  if (options?.label) {
    const root = new Uint8Array(BytsPerSec);
    const RootDirSec = RsvdSecCnt + FATSz * NumFATs + (bpbFat32 ? (bpb.RootClus - MIN_CLUS_NUM) * SecPerClus : 0);
    const sfn = new Uint8Array(DIR_NAME_LENGTH).fill(" ".charCodeAt(0));
    sfn.set(options.label.subarray(0, DIR_NAME_LENGTH));
    writeDirEntry(createIO(root), 0, createVolumeDirEntry(sfn));
    dataSectors.push({ i: RootDirSec, data: root });
  }
  return {
    bytsPerSec: BytsPerSec,
    zeroRegions,
    dataSectors
  };
};
var mkfsvfat = (capacity, options) => {
  const floppyFormat = FLOPPY_FORMATS.get(capacity / 1024);
  const diskLayout = floppyFormat ? createFloppyDiskLayout(capacity, floppyFormat) : createDiskLayout(capacity, options);
  if (!diskLayout) {
    return null;
  }
  const { IndexBits, BytsPerSecBits, SecPerClusBits, RsvdSecCnt, NumFATs, RootDirSectors, FATSz, TotSec, CountOfClusters } = diskLayout;
  const bootSector = createBootSector(diskLayout, options);
  const sectors = createDiskSectors(IndexBits, bootSector, options);
  return {
    sectors,
    id: bootSector.VolID,
    type: "FAT" + IndexBits,
    totSec: TotSec,
    rsvdSecCnt: RsvdSecCnt,
    numFATs: NumFATs,
    fatSz: FATSz,
    rootDirSectors: RootDirSectors,
    countOfClusters: CountOfClusters,
    secPerClus: 1 << SecPerClusBits,
    bytsPerSec: 1 << BytsPerSecBits
  };
};

// src/fs.mjs
var LFN_ENABLED = typeof USE_LFN === "boolean" ? USE_LFN : true;
var NODE_ROOT = 0;
var NODE_LABEL = 1;
var NODE_DOT_DIR = 2;
var NODE_REG_DIR = 3;
var NODE_REG_FILE = 4;
var NODE_DELETED = 5;
var NODE_LAST = 6;
var DIR_LN_LAST_LONG_ENTRY = 64;
var createNode = (kind, shortName, offset, dirEntry) => {
  const isRoot = kind === NODE_ROOT;
  const isRegDir = kind === NODE_REG_DIR;
  const isRegFile = kind === NODE_REG_FILE;
  return {
    shortName,
    dirOffset: offset,
    dirEntry,
    fstClus: dirEntry.FstClusHI << 16 | dirEntry.FstClusLO,
    isRoot,
    isLabel: kind === NODE_LABEL,
    isRegDir,
    isRegFile,
    isDir: isRoot || isRegDir,
    isReg: isRegDir || isRegFile,
    isDeleted: kind === NODE_DELETED,
    isLast: kind === NODE_LAST,
    // LFN extension
    longName: shortName,
    firstDirOffset: offset,
    dirCount: 1
  };
};
var DUMMY_DIR = createDirEntry(new Uint8Array(DIR_NAME_LENGTH), null);
var ROOT_NODE = createNode(NODE_ROOT, "", 0, DUMMY_DIR);
var DOT_SFN = str2bytes(".          ");
var DOT_DOT_SFN = str2bytes("..         ");
var readNode = (io, flag, offset, cp) => {
  if (flag === DIR_ENTRY_FLAG_LAST) {
    return createNode(NODE_LAST, "", offset, DUMMY_DIR);
  }
  if (flag === DIR_ENTRY_FLAG_DELETED) {
    return createNode(NODE_DELETED, "", offset, DUMMY_DIR);
  }
  const dir = loadDirEntry(io);
  const dirName = dir.Name;
  const dirAttributes = dir.Attributes;
  const isLabel = (dirAttributes & DIR_ENTRY_ATTR_VOLUME_ID) > 0;
  if (isLabel) {
    return createNode(NODE_LABEL, cp.decode(dirName).trimEnd(), offset, dir);
  }
  const isDir = (dirAttributes & DIR_ENTRY_ATTR_DIRECTORY) > 0;
  if (isDir && dirName.every((it, i) => it === DOT_SFN[i])) {
    return createNode(NODE_DOT_DIR, ".", offset, dir);
  }
  if (isDir && dirName.every((it, i) => it === DOT_DOT_SFN[i])) {
    return createNode(NODE_DOT_DIR, "..", offset, dir);
  }
  if (dirName.every(isShortNameValidCode)) {
    const shortName = sfnToStr(dirName, cp);
    if (shortName && !shortName.startsWith(" ")) {
      return createNode(isDir ? NODE_REG_DIR : NODE_REG_FILE, shortName, offset, dir);
    }
  }
  return null;
};
var flushDirEntry = (driver, offset, dirEntry) => {
  const array = new Uint8Array(DIR_ENTRY_SIZE);
  const io = createIO(array);
  writeDirEntry(io, 0, dirEntry);
  driver.writeUint8Array(offset, array);
};
var flushNode = (driver, node) => {
  flushDirEntry(driver, node.dirOffset, node.dirEntry);
};
var loadFATVariables = (bs) => {
  const bpb = bs.bpb;
  const bpbFat32 = isBpbFat32(bpb);
  const { BytsPerSec, SecPerClus, RsvdSecCnt, NumFATs, RootEntCnt, TotSec16, FATSz16, TotSec32, FATSz32, RootClus } = bpb;
  const RootDirSectors = bpbFat32 ? 0 : Math.ceil((RootEntCnt << DIR_ENTRY_SIZE_BITS) / BytsPerSec);
  const FATSz = bpbFat32 ? FATSz32 : FATSz16;
  const TotSec = TotSec16 ? TotSec16 : TotSec32;
  const MetaSec = RsvdSecCnt + FATSz * NumFATs + RootDirSectors;
  const DataSec = TotSec - MetaSec;
  const SizeOfCluster = BytsPerSec * SecPerClus;
  const CountOfClusters = Math.floor(DataSec / SecPerClus);
  const IndexBits = bpbFat32 ? 32 : CountOfClusters < FAT_THRESHOLD ? 12 : 16;
  const MaxClus = CountOfClusters + 1;
  const SystemArea = RsvdSecCnt + FATSz * NumFATs;
  const RootDirSec = SystemArea + (bpbFat32 ? (RootClus - MIN_CLUS_NUM) * SecPerClus : 0);
  const FirstDataSec = SystemArea + RootDirSectors;
  const RootDirOffset = BytsPerSec * RootDirSec;
  const FinalClus = (1 << Math.min(28, IndexBits)) - 1;
  return {
    FATSz,
    TotSec,
    DataSec,
    SizeOfCluster,
    CountOfClusters,
    IndexBits,
    MaxClus,
    FirstDataSec,
    RootDirOffset,
    FinalClus
  };
};
var match = (name, node) => {
  const upper = name.toUpperCase();
  return upper === node.shortName || LFN_ENABLED && upper === node.longName.toUpperCase();
};
var fillNode = (node, chain, firstDirOffset) => {
  if (LFN_ENABLED && chain.length) {
    const ord = chain[chain.length - 1].Ord & DIR_LN_LAST_LONG_ENTRY - 1;
    if (ord === 1) {
      const chksum = getChkSum(node.dirEntry.Name);
      if (chain.every((it) => it.Chksum === chksum)) {
        node.longName = lfnToStr(chain);
        node.firstDirOffset = firstDirOffset;
        node.dirCount = chain.length + 1;
      } else {
      }
    } else {
    }
  }
};
var FAT122 = class {
  /**
   * @param {!Driver} driver
   * @param {!FATVariables} vars
   * @param {!Array<number>} offsetFATs
   */
  constructor(driver, vars, offsetFATs) {
    this.driver = driver;
    this.vars = vars;
    this.offsetFATs = offsetFATs;
  }
  /**
   * @override
   * @param {number} clusNum
   * @return {number}
   */
  // @ts-expect-error
  getNextClusNum(clusNum) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    const val = driver.readWord(offsetFATs[0] + clusNum + (clusNum >> 1));
    return clusNum & 1 ? val >> 4 : val & vars.FinalClus;
  }
  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  // @ts-expect-error
  setNextClusNum(clusNum, value) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    for (let i = 0; i < offsetFATs.length; i++) {
      const address = offsetFATs[i] + clusNum + (clusNum >> 1);
      const val = driver.readWord(address);
      driver.writeWord(address, clusNum & 1 ? value << 4 | val & 15 : val & 61440 | value);
    }
  }
  /**
   * @override
   * @return  {number}
   */
  // @ts-expect-error
  // eslint-disable-next-line class-methods-use-this
  getNextFreeClus() {
    return MIN_CLUS_NUM;
  }
  /**
   * @override
   * @param {number} clusNum
   */
  // @ts-expect-error
  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  setNextFreeClus(clusNum) {
  }
};
var FAT162 = class {
  /**
   * @param {!Driver} driver
   * @param {!FATVariables} vars
   * @param {!Array<number>} offsetFATs
   */
  constructor(driver, vars, offsetFATs) {
    this.driver = driver;
    this.vars = vars;
    this.offsetFATs = offsetFATs;
  }
  /**
   * @override
   * @param {number} clusNum
   * @return {number}
   */
  // @ts-expect-error
  getNextClusNum(clusNum) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    return driver.readWord(offsetFATs[0] + clusNum * 2);
  }
  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  // @ts-expect-error
  setNextClusNum(clusNum, value) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    for (let i = 0; i < offsetFATs.length; i++) {
      driver.writeWord(offsetFATs[i] + clusNum * 2, value);
    }
  }
  /**
   * @override
   * @return  {number}
   */
  // @ts-expect-error
  // eslint-disable-next-line class-methods-use-this
  getNextFreeClus() {
    return MIN_CLUS_NUM;
  }
  /**
   * @override
   * @param {number} clusNum
   */
  // @ts-expect-error
  // eslint-disable-next-line no-unused-vars, class-methods-use-this
  setNextFreeClus(clusNum) {
  }
};
var FAT322 = class {
  /**
   * @param {!Driver} driver
   * @param {!FATVariables} vars
   * @param {!Array<number>} offsetFATs
   * @param {number} fsiOffset
   * @param {number} fsiNxtFreeOffset
   */
  constructor(driver, vars, offsetFATs, fsiOffset, fsiNxtFreeOffset) {
    this.driver = driver;
    this.vars = vars;
    this.offsetFATs = offsetFATs;
    this.fsiOffset = fsiOffset;
    this.fsiNxtFreeOffset = fsiNxtFreeOffset;
  }
  /**
   * @override
   * @param {number} clusNum
   * @return {number}
   */
  // @ts-expect-error
  getNextClusNum(clusNum) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    return driver.readDoubleWord(offsetFATs[0] + clusNum * 4) & vars.FinalClus;
  }
  /**
   * @override
   * @param {number} clusNum
   * @param {number} value
   */
  // @ts-expect-error
  setNextClusNum(clusNum, value) {
    const { driver, vars, offsetFATs } = this;
    assert(clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus);
    for (let i = 0; i < offsetFATs.length; i++) {
      const address = offsetFATs[i] + clusNum * 4;
      const val = driver.readDoubleWord(address);
      driver.writeDoubleWord(address, val & 4026531840 | value);
    }
  }
  /**
   * @override
   * @return  {number}
   */
  // @ts-expect-error
  getNextFreeClus() {
    const { driver, vars, fsiNxtFreeOffset } = this;
    const clusNum = driver.readDoubleWord(fsiNxtFreeOffset);
    return clusNum >= MIN_CLUS_NUM && clusNum <= vars.MaxClus ? clusNum : MIN_CLUS_NUM;
  }
  /**
   * @override
   * @param {number} clusNum
   */
  // @ts-expect-error
  setNextFreeClus(clusNum) {
    const { driver, fsiNxtFreeOffset } = this;
    driver.writeDoubleWord(fsiNxtFreeOffset, clusNum);
  }
};
var FileIO = class {
  /**
   * @param {!FileSystem} fs
   * @param {!FATNode} node
   */
  constructor(fs, node) {
    this.fs = fs;
    this.sizeOfCluster = fs.vars.SizeOfCluster;
    this.node = node;
    this.prev = 0;
    this.curr = node.fstClus;
    this.pos = 0;
    this.fileSize = 0;
  }
  /**
   * @override
   */
  // @ts-expect-error
  rewind() {
    this.prev = 0;
    this.curr = this.node.fstClus;
    this.pos = 0;
    this.fileSize = 0;
  }
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  skipClus() {
    const { fs, sizeOfCluster, node } = this;
    let len = Math.min(sizeOfCluster, Math.max(0, node.dirEntry.FileSize - this.pos));
    if (len) {
      if (this.curr >= MIN_CLUS_NUM && this.curr <= fs.vars.MaxClus) {
        this.prev = this.curr;
        this.curr = fs.FAT.getNextClusNum(this.curr);
        this.pos += sizeOfCluster;
      } else {
        len = 0;
      }
    }
    return len;
  }
  /**
   * @override
   * @param {!Uint8Array} buf
   * @return {number}
   */
  // @ts-expect-error
  readClus(buf) {
    const { fs, sizeOfCluster, node } = this;
    let len = Math.min(sizeOfCluster, Math.max(0, node.dirEntry.FileSize - this.pos));
    if (len) {
      const offset = fs.getContentOffset(this.curr);
      if (offset) {
        buf.set(fs.driver.readUint8Array(offset, len));
        this.prev = this.curr;
        this.curr = fs.FAT.getNextClusNum(this.curr);
        this.pos += sizeOfCluster;
      } else {
        len = 0;
      }
    }
    return len;
  }
  /**
   * @override
   * @param {!Uint8Array} buf
   * @return {number}
   */
  // @ts-expect-error
  writeClus(buf) {
    assert(buf.length > 0);
    const { fs, sizeOfCluster, node } = this;
    const len = Math.min(sizeOfCluster, buf.length);
    let offset = fs.getContentOffset(this.curr);
    if (!offset) {
      const newClusNum = fs.allocateCluster();
      if (!newClusNum) {
        return 0;
      }
      if (node.fstClus) {
        fs.FAT.setNextClusNum(this.prev, newClusNum);
      } else {
        this.setFirstClus(newClusNum);
      }
      this.curr = newClusNum;
      offset = fs.getContentOffset(newClusNum);
      node.dirEntry.FileSize = this.pos + len;
      flushNode(this.fs.driver, this.node);
    }
    fs.driver.writeUint8Array(offset, buf.subarray(0, len));
    this.fileSize = this.pos + len;
    this.prev = this.curr;
    this.curr = fs.FAT.getNextClusNum(this.curr);
    this.pos += sizeOfCluster;
    return len;
  }
  /**
   * @override
   * @return {!Uint8Array}
   */
  // @ts-expect-error
  readData() {
    this.rewind();
    const fileSize = this.node.dirEntry.FileSize;
    const data = new Uint8Array(fileSize);
    if (fileSize) {
      let len;
      let tmp = data;
      while (len = this.readClus(tmp)) {
        tmp = tmp.subarray(len);
      }
    }
    return data;
  }
  /**
   * @override
   * @param {!Uint8Array} data
   * @return {number}
   */
  // @ts-expect-error
  writeData(data) {
    this.rewind();
    let len;
    let tmp = data;
    while (tmp.length && (len = this.writeClus(tmp))) {
      tmp = tmp.subarray(len);
    }
    this.fs.unlink(this.curr);
    if (this.node.fstClus === this.curr) {
      this.setFirstClus(0);
      assert(this.pos === 0);
      assert(this.fileSize === 0);
    }
    this.node.dirEntry.FileSize = this.fileSize;
    flushNode(this.fs.driver, this.node);
    const fileSize = data.length - tmp.length;
    assert(fileSize === this.node.dirEntry.FileSize);
    return fileSize;
  }
  // Private
  /**
   * @private
   * @param {number} clusNum
   */
  setFirstClus(clusNum) {
    const { dirEntry } = this.node;
    this.node.fstClus = clusNum;
    dirEntry.FstClusHI = clusNum >>> 16;
    dirEntry.FstClusLO = clusNum & 65535;
    flushNode(this.fs.driver, this.node);
  }
};
var File = class _File {
  /**
   * @param {!FileSystem} fs
   * @param {string} absolutePath
   * @param {!FATNode} node
   */
  constructor(fs, absolutePath, node) {
    this.fs = fs;
    this.absolutePath = absolutePath;
    this.node = node;
  }
  // ns.File
  /**
   * @override
   * @return {string}
   */
  // @ts-expect-error
  getName() {
    return this.node.longName;
  }
  /**
   * @override
   * @return {string}
   */
  // @ts-expect-error
  getShortName() {
    return this.node.shortName;
  }
  /**
   * @override
   * @return {string}
   */
  // @ts-expect-error
  getAbsolutePath() {
    return this.absolutePath;
  }
  /**
   * @override
   * @return {boolean}
   */
  // @ts-expect-error
  isRegularFile() {
    return this.node.isRegFile;
  }
  /**
   * @override
   * @return {boolean}
   */
  // @ts-expect-error
  isDirectory() {
    return this.node.isDir;
  }
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  length() {
    const ls = this.listFiles();
    if (ls) {
      let len = 0;
      for (let i = 0; i < ls.length; i++) {
        len += ls[i].length();
      }
      return len;
    }
    return this.node.dirEntry.FileSize;
  }
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  getSizeOnDisk() {
    const fs = this.fs;
    const node = this.node;
    let clusCnt = 0;
    fs.dfs(node, (it) => {
      clusCnt += fs.getClusterChainLength(it.fstClus);
    });
    if (node.isRoot) {
      clusCnt += fs.getClusterChainLength(fs.getClusNum(fs.vars.RootDirOffset));
    }
    return clusCnt * fs.vars.SizeOfCluster;
  }
  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @return {?Date}
   */
  // @ts-expect-error
  getLastModified() {
    const { dirEntry } = this.node;
    return parseDateTime(dirEntry.WrtDate, dirEntry.WrtTime, 0);
  }
  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @param {?Date} date
   */
  // @ts-expect-error
  setLastModified(date) {
    const { dirEntry } = this.node;
    dirEntry.WrtTime = toTime(date);
    dirEntry.WrtDate = toDate(date);
    flushNode(this.fs.driver, this.node);
  }
  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @return {?Date}
   */
  // @ts-expect-error
  getCreationTime() {
    const { dirEntry } = this.node;
    return parseDateTime(dirEntry.CrtDate, dirEntry.CrtTime, dirEntry.CrtTimeTenth);
  }
  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @param {?Date} date
   */
  // @ts-expect-error
  setCreationTime(date) {
    const { dirEntry } = this.node;
    dirEntry.CrtTimeTenth = toTimeTenth(date);
    dirEntry.CrtTime = toTime(date);
    dirEntry.CrtDate = toDate(date);
    flushNode(this.fs.driver, this.node);
  }
  /**
   * yyyy.MM.dd
   * @override
   * @return {?Date}
   */
  // @ts-expect-error
  getLastAccessTime() {
    return parseDate(this.node.dirEntry.LstAccDate);
  }
  /**
   * yyyy.MM.dd HH:mm:ss
   * @override
   * @param {?Date} date
   */
  // @ts-expect-error
  setLastAccessTime(date) {
    const { dirEntry } = this.node;
    dirEntry.LstAccDate = toDate(date);
    flushNode(this.fs.driver, this.node);
  }
  /**
   * @override
   * @param {function(!File):boolean} predicate
   * @return {?File}
   */
  // @ts-expect-error
  findFirst(predicate) {
    let file = null;
    const node = this.fs.findFirstRegNode(this.node, (it) => predicate(file = this.createFile(it.longName, it)));
    return node ? file : null;
  }
  /**
   * @override
   * @param {function(!File):boolean} predicate
   * @return {?Array<!File>}
   */
  // @ts-expect-error
  findAll(predicate) {
    if (!this.node.isDir) {
      return null;
    }
    const files = [];
    this.findFirst((file) => {
      if (predicate(file)) {
        files.push(file);
      }
      return false;
    });
    return files;
  }
  /**
   * @override
   * @return {?Array<!File>}
   */
  // @ts-expect-error
  listFiles() {
    return this.findAll(() => true);
  }
  /**
   * @override
   * @return {?ns.FileIO}
   */
  // @ts-expect-error
  open() {
    return this.node.isRegFile ? new FileIO(this.fs, this.node) : null;
  }
  /**
   * @override
   */
  // @ts-expect-error
  delete() {
    const node = this.node;
    const fs = this.fs;
    fs.dfs(node, (it) => {
      fs.unlink(it.fstClus);
      this.fs.markNodeDeleted(it);
    });
    if (node.isRoot) {
      const rootClusNum = fs.getClusNum(fs.vars.RootDirOffset);
      if (rootClusNum) {
        const label = this.fs.getLabel();
        fs.unlink(rootClusNum);
        fs.writeZeros(rootClusNum);
        fs.FAT.setNextClusNum(rootClusNum, this.fs.vars.FinalClus);
        this.fs.setLabel(label);
      }
    }
  }
  /**
   * @override
   * @param {string} relativePath
   * @return {?File}
   */
  // @ts-expect-error
  getFile(relativePath) {
    return this.traverse(relativePath, (node, name) => this.fs.findFirstRegNode(node, (it) => match(name, it)));
  }
  /**
   * @override
   * @param {string} relativePath
   * @return {?File}
   */
  // @ts-expect-error
  makeFile(relativePath) {
    return this.getOrMakeFileOrDirectory(relativePath, true);
  }
  /**
   * @override
   * @param {string} relativePath
   * @return {?File}
   */
  // @ts-expect-error
  makeDir(relativePath) {
    return this.getOrMakeFileOrDirectory(relativePath, false);
  }
  /**
   * @override
   * @param {string} dest
   * @return {?File}
   */
  // @ts-expect-error
  moveTo(dest) {
    const node = this.node;
    if (node.isRoot) {
      return null;
    }
    if (!dest.startsWith("/") && !dest.startsWith("\\")) {
      dest = this.absolutePath.substring(0, this.absolutePath.length - node.longName.length) + dest;
    }
    if (this.contains(dest)) {
      return null;
    }
    const destFile = this.fs.root.getFile(dest);
    if (destFile && destFile.node.isRegFile) {
      return null;
    }
    const isFile = !node.isRegDir;
    const target = destFile ? destFile.getOrMakeFileOrDirectory(node.longName, isFile) : this.fs.root.getOrMakeFileOrDirectory(dest, isFile);
    if (!target) {
      return null;
    }
    const src = node;
    const dst = target.node;
    if (src.firstDirOffset === dst.firstDirOffset) {
      return target;
    }
    this.fs.unlink(dst.fstClus);
    const srcDir = src.dirEntry;
    const destDir = dst.dirEntry;
    dst.fstClus = src.fstClus;
    destDir.CrtTimeTenth = srcDir.CrtTimeTenth;
    destDir.CrtTime = srcDir.CrtTime;
    destDir.CrtDate = srcDir.CrtDate;
    destDir.LstAccDate = srcDir.LstAccDate;
    destDir.FstClusHI = srcDir.FstClusHI;
    destDir.WrtTime = srcDir.WrtTime;
    destDir.WrtDate = srcDir.WrtDate;
    destDir.FstClusLO = srcDir.FstClusLO;
    destDir.FileSize = srcDir.FileSize;
    flushDirEntry(this.fs.driver, dst.dirOffset, destDir);
    this.fs.markNodeDeleted(src);
    return target;
  }
  // Private
  /**
   * @private
   * @param {string} relativePath
   * @param {boolean} isFile
   * @return {?File}
   */
  getOrMakeFileOrDirectory(relativePath, isFile) {
    return this.traverse(relativePath, (node, name, isLast) => this.fs.getOrMakeNode(node, name, isFile && isLast));
  }
  /**
   * @private
   * @param {string} absolutePath
   * @return {number}
   */
  contains(absolutePath) {
    if (this.node.isRegFile) {
      return 0;
    }
    const srcNames = split(this.absolutePath);
    const destNames = split(absolutePath);
    let i = this.fs.root;
    let j = i;
    let k = 0;
    while (true) {
      if (k === srcNames.length) {
        return 1;
      }
      if (k === destNames.length) {
        return 0;
      }
      const srcName = srcNames[k];
      const destName = destNames[k];
      const srcChild = i.findFirst((file) => match(srcName, file.node));
      const destChild = j.findFirst((file) => match(destName, file.node));
      if (!srcChild) {
        assert(false);
        return 0;
      }
      if (!destChild) {
        return 0;
      }
      if (srcChild.node.firstDirOffset !== destChild.node.firstDirOffset) {
        return 0;
      }
      i = srcChild;
      j = destChild;
      k++;
    }
  }
  /**
   * @private
   * @param {string} relativePath
   * @param {!FATNode} node
   * @return {!File}
   */
  createFile(relativePath, node) {
    return new _File(this.fs, (this.node.isRoot ? "" : this.absolutePath) + "/" + relativePath, node);
  }
  /**
   * @private
   * @param {string} relativePath
   * @param {function(!FATNode,string,boolean):?FATNode} func
   * @return {?File}
   */
  traverse(relativePath, func) {
    let node = this.node;
    const names = split(relativePath);
    const longNames = [];
    let i = 0;
    while (i < names.length && node) {
      node = func(node, names[i], i === names.length - 1);
      if (node) {
        longNames.push(node.longName);
      }
      i++;
    }
    return node ? this.createFile(longNames.join("/"), node) : null;
  }
};
var FileSystem = class {
  /**
   * @param {!Driver} driver
   * @param {!BootSector} bs
   * @param {!FATVariables} vars
   * @param {!FAT} fat
   * @param {!ns.Codepage} cp
   */
  constructor(driver, bs, vars, fat, cp) {
    this.driver = driver;
    this.bs = bs;
    this.cp = cp;
    this.vars = vars;
    this.root = new File(this, "/", ROOT_NODE);
    this.FAT = fat;
  }
  // ns.FileSystem
  /**
   * @override
   * @return {string}
   */
  // @ts-expect-error
  getName() {
    return "FAT" + this.vars.IndexBits;
  }
  /**
   * @override
   * @return {string}
   */
  // @ts-expect-error
  getLabel() {
    return this.findFirstLabelNode()?.shortName ?? this.cp.decode(this.bs.VolLab).trimEnd();
  }
  /**
   * @override
   * @param {?string} label
   * @return {undefined}
   */
  // @ts-expect-error
  setLabel(label) {
    const node = this.findFirstLabelNode();
    if (label) {
      const sfn = strToUint8Array(this.cp, DIR_NAME_LENGTH, label);
      const dirEntry = createVolumeDirEntry(sfn);
      const offset = node?.dirOffset ?? this.allocate(ROOT_NODE, 1);
      if (offset) {
        flushDirEntry(this.driver, offset, dirEntry);
      } else {
      }
    } else if (node) {
      this.markNodeDeleted(node);
    }
  }
  /**
   * @override
   * @return {?string}
   */
  // @ts-expect-error
  getOEMName() {
    return this.cp.decode(this.bs.OEMName).trimEnd();
  }
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  getId() {
    return this.bs.VolID;
  }
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  getSizeOfCluster() {
    return this.vars.SizeOfCluster;
  }
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  getCountOfClusters() {
    return this.vars.CountOfClusters;
  }
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  getFreeClusters() {
    let count = 0;
    for (let i = MIN_CLUS_NUM; i <= this.vars.MaxClus; i++) {
      if (this.FAT.getNextClusNum(i) === FREE_CLUS) {
        count++;
      }
    }
    return count;
  }
  /**
   * @override
   * @return {!File}
   */
  // @ts-expect-error
  getRoot() {
    return this.root;
  }
  // Find nodes
  /**
   * @param {!FATNode} node
   * @param {function(!FATNode):boolean} predicate
   * @return {?FATNode}
   */
  findFirstRegNode(node, predicate) {
    return this.findFirstNode(node, (it) => it.isReg && predicate(it));
  }
  /**
   * @private
   * @param {!FATNode} node
   * @param {function(!FATNode):boolean} predicate
   * @return {?FATNode}
   */
  findFirstNode(node, predicate) {
    let it = this.getFirst(node);
    while (it && !predicate(it)) {
      it = this.getNext(it, 1);
    }
    return it;
  }
  /**
   * @private
   * @return {?FATNode}
   */
  findFirstLabelNode() {
    return this.findFirstNode(ROOT_NODE, (it) => it.isLabel);
  }
  // Node navigation
  /**
   * @param {!FATNode} node
   * @param {function(!FATNode):void} func
   */
  dfs(node, func) {
    let it = this.getFirst(node);
    while (it) {
      const next = this.getNext(it, 1);
      if (it.isReg) {
        this.dfs(it, func);
      }
      it = next;
    }
    if (node.isReg) {
      func(node);
    }
  }
  /**
   * @param {!FATNode} parent
   * @param {string} name
   * @param {boolean} isFile
   * @return {?FATNode}
   */
  getOrMakeNode(parent, name, isFile) {
    if (!parent.isDir) {
      return null;
    }
    const filename = normalizeLongName(name);
    if (!filename || filename.length > LFN_MAX_LEN) {
      return null;
    }
    const used = /* @__PURE__ */ new Set();
    {
      const test = filename.toUpperCase();
      const node = this.findFirstRegNode(parent, (dir) => {
        let upper = dir.shortName.toUpperCase();
        used.add(upper);
        let found = test === upper;
        if (LFN_ENABLED && !found) {
          upper = dir.longName.toUpperCase();
          used.add(upper);
          found = test === upper;
        }
        return found;
      });
      if (node) {
        return node.isRegFile && isFile || node.isRegDir && !isFile ? node : null;
      }
    }
    const cp = this.cp;
    let shortName = filename;
    let sfn = strToSfn(shortName, cp);
    if (!sfn && filename !== (shortName = shortName.toUpperCase())) {
      sfn = strToSfn(shortName, cp);
    }
    if (!sfn) {
      sfn = strToSfn(shortName = strToTildeName(filename, cp, used), cp);
    }
    if (!sfn) {
      assert(false);
      return null;
    }
    return this.makeNode(parent, isFile, shortName, filename, sfn);
  }
  /**
   * @param {!FATNode} node
   */
  markNodeDeleted(node) {
    assert(node.isLabel || node.isReg);
    const { driver } = this;
    if (LFN_ENABLED) {
      let offset = node.firstDirOffset;
      for (let i = 0; i < node.dirCount && offset > 0; i++) {
        driver.writeByte(offset, DIR_ENTRY_FLAG_DELETED);
        offset = this.getNextDirEntryOffset(offset) ?? this.getNextDirEntryOffsetFromNextClusNum(offset);
      }
    } else {
      driver.writeByte(node.dirOffset, DIR_ENTRY_FLAG_DELETED);
    }
  }
  /**
   * @private
   * @param {!FATNode} parent
   * @param {boolean} isFile
   * @param {string} shortName
   * @param {string} longName
   * @param {!Uint8Array} sfn
   * @return {?FATNode}
   */
  makeNode(parent, isFile, shortName, longName, sfn) {
    const dirLFNs = [];
    if (LFN_ENABLED && longName !== shortName) {
      const lfn = strToLfn(longName);
      if (!lfn) {
        return null;
      }
      const Chksum = getChkSum(sfn);
      let i = 0;
      while (i < lfn.length) {
        dirLFNs.push({
          Ord: 1 + dirLFNs.length,
          Name1: lfn.subarray(i, i += LFN_NAME1_LENGTH),
          Attributes: DIR_ENTRY_ATTR_LFN,
          Type: 0,
          Chksum,
          Name2: lfn.subarray(i, i += LFN_NAME2_LENGTH),
          FstClusLO: 0,
          Name3: lfn.subarray(i, i += LFN_NAME3_LENGTH)
        });
      }
      const last = dirLFNs[dirLFNs.length - 1];
      assert(last.Ord < DIR_LN_LAST_LONG_ENTRY);
      last.Ord |= DIR_LN_LAST_LONG_ENTRY;
    }
    const dirCount = dirLFNs.length + 1;
    const firstDirOffset = this.allocate(parent, dirCount);
    if (!firstDirOffset) {
      return null;
    }
    const dirEntry = createDirEntry(sfn, /* @__PURE__ */ new Date());
    if (!isFile) {
      const clusNum = this.allocateCluster();
      if (!clusNum) {
        return null;
      }
      const clusOffset = this.writeZeros(clusNum);
      assert(clusOffset > 0);
      dirEntry.FstClusLO = clusNum & 65535;
      dirEntry.FstClusHI = clusNum >>> 16;
      dirEntry.Attributes = DIR_ENTRY_ATTR_DIRECTORY;
      const array = new Uint8Array(2 * DIR_ENTRY_SIZE);
      const io = createIO(array);
      writeDirEntry(io, 0, createDotDirEntry(DOT_SFN, dirEntry));
      writeDirEntry(io, DIR_ENTRY_SIZE, createDotDirEntry(DOT_DOT_SFN, parent.dirEntry));
      this.driver.writeUint8Array(clusOffset, array);
    }
    let offset = firstDirOffset;
    if (LFN_ENABLED) {
      const len = dirLFNs.length;
      for (let i = 0; i < len; i++) {
        const array = new Uint8Array(DIR_ENTRY_SIZE);
        const io = createIO(array);
        writeDirEntryLFN(io, 0, dirLFNs[len - 1 - i]);
        this.driver.writeUint8Array(offset, array);
        offset = this.getNextDirEntryOffset(offset) ?? this.getNextDirEntryOffsetFromNextClusNum(offset);
        assert(offset > 0);
      }
    }
    flushDirEntry(this.driver, offset, dirEntry);
    const kind = isFile ? NODE_REG_FILE : NODE_REG_DIR;
    const node = createNode(kind, shortName, offset, dirEntry);
    if (LFN_ENABLED) {
      node.longName = longName;
      node.firstDirOffset = firstDirOffset;
      node.dirCount = dirCount;
    }
    return node;
  }
  /**
   * @private
   * @param {!FATNode} node
   * @param {number} dirCount
   * @return {number} offset or 0 if cannot allocate
   */
  allocate(node, dirCount) {
    assert(node.isDir);
    let firstDirOffset = 0;
    let allocated = 0;
    const { driver, vars } = this;
    let offset = vars.RootDirOffset;
    if (node.isRegDir) {
      assert(node.fstClus > 0);
      offset = this.getContentOffset(node.fstClus);
    }
    let lastOffset = offset;
    while (offset) {
      lastOffset = offset;
      const flag = driver.readByte(offset);
      if (flag === DIR_ENTRY_FLAG_LAST || flag === DIR_ENTRY_FLAG_DELETED) {
        if (allocated === 0) {
          firstDirOffset = offset;
        }
        allocated++;
        if (allocated >= dirCount) {
          return firstDirOffset;
        }
      } else {
        allocated = 0;
      }
      offset = this.getNextDirEntryOffset(offset) ?? this.getNextDirEntryOffsetFromNextClusNum(offset);
    }
    const lastClus = this.getClusNum(lastOffset);
    if (!lastClus) {
      assert(this.vars.IndexBits !== 32 && node.isRoot);
      return 0;
    }
    assert(this.vars.IndexBits === 32 || !node.isRoot);
    const allocateSize = (dirCount - allocated) * DIR_ENTRY_SIZE;
    assert(allocateSize > 0);
    const allocateClusCnt = Math.ceil(allocateSize / this.vars.SizeOfCluster);
    assert(allocateClusCnt === 1 || allocateClusCnt === 2);
    const clus1 = this.allocateCluster();
    if (!clus1) {
      return 0;
    }
    this.writeZeros(clus1);
    this.FAT.setNextClusNum(lastClus, clus1);
    if (allocateClusCnt === 2) {
      const clus2 = this.allocateCluster();
      if (!clus2) {
        return 0;
      }
      this.writeZeros(clus2);
      this.FAT.setNextClusNum(clus1, clus2);
    }
    return allocated > 0 ? firstDirOffset : this.getContentOffset(clus1);
  }
  /**
   * @private
   * @param {!FATNode} node
   * @return {?FATNode}
   */
  getFirst(node) {
    if (node.isRoot) {
      return this.loadFromOffset(this.vars.RootDirOffset);
    }
    if (node.isRegDir) {
      const offset = this.getContentOffset(node.fstClus);
      if (offset) {
        return this.loadFromOffset(offset);
      }
    }
    return null;
  }
  /**
   * @private
   * @param {!FATNode} node
   * @param {number} noLast
   * @return {?FATNode}
   */
  getNext(node, noLast) {
    const lastDirOffset = node.dirOffset;
    if (lastDirOffset > 0) {
      const offset = this.getNextDirEntryOffset(lastDirOffset) ?? this.getNextDirEntryOffsetFromNextClusNum(lastDirOffset);
      if (offset) {
        const next = this.loadFromOffset(offset);
        return noLast && next?.isLast ? null : next;
      }
    }
    return null;
  }
  /**
   * @private
   * @param {number} firstDirOffset
   * @return {?FATNode}
   */
  loadFromOffset(firstDirOffset) {
    const { driver } = this;
    const chain = [];
    let offset = firstDirOffset;
    let skipped = 0;
    while (offset) {
      const array = driver.readUint8Array(offset, DIR_ENTRY_SIZE);
      const io = createIO(array);
      const flag = array[0];
      if (LFN_ENABLED && flag !== DIR_ENTRY_FLAG_LAST && flag !== DIR_ENTRY_FLAG_DELETED && isDirEntryLFN(io)) {
        const dirLFN = loadDirEntryLFN(io);
        if (dirLFN.Ord & DIR_LN_LAST_LONG_ENTRY) {
          if (chain.length) {
            skipped += chain.length;
          }
          chain.length = 0;
          chain.push(dirLFN);
        } else if (chain.length) {
          const prev = chain[chain.length - 1].Ord & DIR_LN_LAST_LONG_ENTRY - 1;
          const curr = dirLFN.Ord & DIR_LN_LAST_LONG_ENTRY - 1;
          if (prev === curr + 1) {
            chain.push(dirLFN);
          } else {
            skipped += chain.length;
            chain.length = 0;
          }
        } else {
          skipped++;
        }
      } else {
        const node = readNode(io, flag, offset, this.cp);
        if (node) {
          fillNode(node, chain, firstDirOffset);
          assert(node.dirCount > 0);
          assert(node.firstDirOffset === firstDirOffset + skipped * DIR_ENTRY_SIZE);
          return node;
        }
        skipped++;
      }
      offset = this.getNextDirEntryOffset(offset) ?? this.getNextDirEntryOffsetFromNextClusNum(offset);
    }
    return null;
  }
  // Math
  /**
   * @param {number} clusNum
   * @return {number}
   */
  getContentOffset(clusNum) {
    if (clusNum >= MIN_CLUS_NUM && clusNum <= this.vars.MaxClus) {
      return this.bs.bpb.BytsPerSec * (this.vars.FirstDataSec + (clusNum - MIN_CLUS_NUM) * this.bs.bpb.SecPerClus);
    }
    return 0;
  }
  /**
   * @param {number} clusNum
   * @return {number}
   */
  getClusterChainLength(clusNum) {
    let count = 0;
    while (clusNum >= MIN_CLUS_NUM && clusNum <= this.vars.MaxClus) {
      count++;
      clusNum = this.FAT.getNextClusNum(clusNum);
    }
    return count;
  }
  /**
   * @param {number} clusNum
   */
  unlink(clusNum) {
    while (clusNum >= MIN_CLUS_NUM && clusNum <= this.vars.MaxClus) {
      const nextClusNum = this.FAT.getNextClusNum(clusNum);
      this.FAT.setNextClusNum(clusNum, FREE_CLUS);
      clusNum = nextClusNum;
    }
  }
  /**
   * @param {number} clusNum
   * @return {number}
   */
  writeZeros(clusNum) {
    const offset = this.getContentOffset(clusNum);
    assert(offset > 0);
    this.driver.writeBytes(offset, 0, this.vars.SizeOfCluster);
    return offset;
  }
  /**
   * @return {number}
   */
  allocateCluster() {
    const nxtFreeClus = this.FAT.getNextFreeClus();
    let i = nxtFreeClus;
    while (i <= this.vars.MaxClus && this.FAT.getNextClusNum(i) !== FREE_CLUS) {
      i++;
    }
    if (i > this.vars.MaxClus) {
      i = MIN_CLUS_NUM;
      while (i < nxtFreeClus && this.FAT.getNextClusNum(i) !== FREE_CLUS) {
        i++;
      }
      if (i >= nxtFreeClus) {
        return 0;
      }
    }
    this.FAT.setNextFreeClus(i + 1);
    this.FAT.setNextClusNum(i, this.vars.FinalClus);
    return i;
  }
  /**
   * @param {number} offset
   * @return {number}
   */
  getClusNum(offset) {
    assert(offset >= 0);
    assert(Number.isInteger(offset));
    const secNum = Math.floor(offset / this.bs.bpb.BytsPerSec);
    const dataSecNum = secNum - this.vars.FirstDataSec;
    return dataSecNum < 0 ? 0 : MIN_CLUS_NUM + Math.floor(dataSecNum / this.bs.bpb.SecPerClus);
  }
  /**
   * @private
   * @param {number} offset
   * @return {?number}
   */
  getNextDirEntryOffset(offset) {
    offset += DIR_ENTRY_SIZE;
    assert(offset > SZ && offset % DIR_ENTRY_SIZE === 0);
    const { BytsPerSec, SecPerClus } = this.bs.bpb;
    const { FirstDataSec } = this.vars;
    if (offset % BytsPerSec !== 0) {
      return offset;
    }
    const secNum = offset / BytsPerSec;
    assert(Number.isInteger(secNum));
    if (secNum < FirstDataSec) {
      return offset;
    }
    if (secNum === FirstDataSec) {
      return 0;
    }
    const dataSecNum = secNum - FirstDataSec;
    if (dataSecNum % SecPerClus !== 0) {
      return offset;
    }
    return null;
  }
  /**
   * @private
   * @param {number} offset
   * @return {number}
   */
  getNextDirEntryOffsetFromNextClusNum(offset) {
    offset += DIR_ENTRY_SIZE;
    assert(offset > SZ && offset % DIR_ENTRY_SIZE === 0);
    const { BytsPerSec, SecPerClus } = this.bs.bpb;
    const { FirstDataSec } = this.vars;
    assert(offset % BytsPerSec === 0);
    const secNum = offset / BytsPerSec;
    assert(Number.isInteger(secNum));
    assert(secNum > FirstDataSec);
    const dataSecNum = secNum - FirstDataSec;
    assert(dataSecNum % SecPerClus === 0);
    const clusNum = 1 + dataSecNum / SecPerClus;
    assert(Number.isInteger(clusNum));
    const nexClusNum = this.FAT.getNextClusNum(clusNum);
    return this.getContentOffset(nexClusNum);
  }
};
var createFileSystem = (driver, cp) => {
  if (driver.len() < SZ) {
    return null;
  }
  try {
    const array = driver.readUint8Array(0, SZ);
    const io = createIO(array);
    const bs = loadBootSector(io);
    const vars = loadFATVariables(bs);
    const offsetFATs = new Array(bs.bpb.NumFATs);
    for (let i = 0; i < bs.bpb.NumFATs; i++) {
      offsetFATs[i] = (bs.bpb.RsvdSecCnt + i * vars.FATSz) * bs.bpb.BytsPerSec;
    }
    let fat;
    if (vars.IndexBits === 12) {
      fat = new FAT122(driver, vars, offsetFATs);
    } else if (vars.IndexBits === 16) {
      fat = new FAT162(driver, vars, offsetFATs);
    } else if (vars.IndexBits === 32) {
      const fsiOffset = bs.bpb.BytsPerSec * bs.bpb.FSInfo;
      const fsiNxtFreeOffset = fsiOffset + FSI_NEXT_FREE_OFFSET;
      loadFSI(createIO(driver.readUint8Array(fsiOffset, SZ)));
      fat = new FAT322(driver, vars, offsetFATs, fsiOffset, fsiNxtFreeOffset);
    } else {
      throw new ValidationError();
    }
    return new FileSystem(driver, bs, vars, fat, cp);
  } catch (e) {
    if (e.name === "ValidationError") {
      return null;
    }
    throw e;
  }
};

// src/disk.mjs
var Disk = class {
  /**
   * @param {!Driver} driver
   * @param {!ns.Codepage} cp
   */
  constructor(driver, cp) {
    this.driver = driver;
    this.cp = cp;
  }
  // ns.Disk
  /**
   * @override
   * @return {number}
   */
  // @ts-expect-error
  capacity() {
    return this.driver.len();
  }
  /**
   * @override
   * @return {?ns.FileSystem}
   */
  // @ts-expect-error
  getFileSystem() {
    return createFileSystem(this.driver, this.cp);
  }
  /**
   * @override
   * @return {!Array<!ns.Partition>}
   */
  // @ts-expect-error
  getPartitions() {
    if (this.driver.len() < SZ) {
      return [];
    }
    const array = this.driver.readUint8Array(0, SZ);
    const io = createIO(array);
    try {
      return loadPartitionTable(io).map(({ BootIndicator, SystemID, RelativeSectors, TotalSectors }) => ({
        active: BootIndicator === 128,
        type: SystemID,
        relativeSectors: RelativeSectors,
        totalSectors: TotalSectors
      }));
    } catch (e) {
      if (e.name === "ValidationError") {
        return [];
      }
      throw e;
    }
  }
  /**
   * @override
   * @param {!ns.DiskSectors} diskSectors
   */
  // @ts-expect-error
  write(diskSectors) {
    const { driver } = this;
    const { bytsPerSec, zeroRegions, dataSectors } = diskSectors;
    for (const {
      /** @type {number} */
      i,
      /** @type {number} */
      count
    } of zeroRegions) {
      driver.writeBytes(bytsPerSec * i, 0, bytsPerSec * count);
    }
    for (const {
      /** @type {number} */
      i,
      /** @type {!Uint8Array} */
      data
    } of dataSectors) {
      driver.writeUint8Array(bytsPerSec * i, data);
    }
  }
};
var createDisk = (driver, cp) => new Disk(driver, cp);

// src/latin1.mjs
var Latin1 = class {
  /**
   * @override
   * @param {!Uint8Array} array
   * @return {string}
   */
  // @ts-expect-error
  // eslint-disable-next-line class-methods-use-this
  decode(array) {
    return new TextDecoder("UTF-16").decode(new Uint16Array(array));
  }
  /**
   * @override
   * @param {string} text
   * @return {!Uint8Array}
   */
  // @ts-expect-error
  // eslint-disable-next-line class-methods-use-this
  encode(text) {
    const len = text.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      const code = text.charCodeAt(i);
      bytes[i] = code < 256 ? code : "?".charCodeAt(0);
    }
    return bytes;
  }
};
var latin1 = new Latin1();

// src/mount.mjs
var createUint8ArrayDriver = (img) => ({
  capacity: img.length,
  /**
   * @param {number} address
   * @param {number} count
   * @return {!Uint8Array}
   */
  read: (address, count) => img.slice(address, address + count),
  /**
   * @param {number} address
   * @param {!Uint8Array} data
   * @return {void}
   */
  write: (address, data) => img.set(data, address)
});
var createPartitionDriver = (partition, driver) => {
  const begin = partition.relativeSectors * SZ;
  const { read, write } = driver;
  const partitionDriver = {
    capacity: partition.totalSectors * SZ,
    /**
     * @param {number} address
     * @param {number} count
     * @return {!Uint8Array}
     */
    read: (address, count) => read(begin + address, count)
  };
  if (write) {
    partitionDriver.write = (address, data) => write(begin + address, data);
  }
  return partitionDriver;
};
var mount = (driver, options) => {
  if (driver instanceof Uint8Array) {
    driver = createUint8ArrayDriver(driver);
  }
  const partition = options?.partition;
  if (partition) {
    driver = createPartitionDriver(partition, driver);
  }
  const driverIO = createDriver(driver);
  return createDisk(driverIO, options?.codepage ?? latin1);
};
export {
  fdisk,
  mkfsvfat,
  mount
};
