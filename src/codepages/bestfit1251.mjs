/**
 * https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WindowsBestFit/bestfit1251.txt
 */
import { Codepage } from "./codepage.mjs";
import { charmapCP1251 } from "./cp1251.mjs";

const wcTableBestfit1251 = {
  0x0000: 0x00,
  0x0001: 0x01,
  0x0002: 0x02,
  0x0003: 0x03,
  0x0004: 0x04,
  0x0005: 0x05,
  0x0006: 0x06,
  0x0007: 0x07,
  0x0008: 0x08,
  0x0009: 0x09,
  0x000a: 0x0a,
  0x000b: 0x0b,
  0x000c: 0x0c,
  0x000d: 0x0d,
  0x000e: 0x0e,
  0x000f: 0x0f,
  0x0010: 0x10,
  0x0011: 0x11,
  0x0012: 0x12,
  0x0013: 0x13,
  0x0014: 0x14,
  0x0015: 0x15,
  0x0016: 0x16,
  0x0017: 0x17,
  0x0018: 0x18,
  0x0019: 0x19,
  0x001a: 0x1a,
  0x001b: 0x1b,
  0x001c: 0x1c,
  0x001d: 0x1d,
  0x001e: 0x1e,
  0x001f: 0x1f,
  0x0020: 0x20,
  0x0021: 0x21,
  0x0022: 0x22,
  0x0023: 0x23,
  0x0024: 0x24,
  0x0025: 0x25,
  0x0026: 0x26,
  0x0027: 0x27,
  0x0028: 0x28,
  0x0029: 0x29,
  0x002a: 0x2a,
  0x002b: 0x2b,
  0x002c: 0x2c,
  0x002d: 0x2d,
  0x002e: 0x2e,
  0x002f: 0x2f,
  0x0030: 0x30,
  0x0031: 0x31,
  0x0032: 0x32,
  0x0033: 0x33,
  0x0034: 0x34,
  0x0035: 0x35,
  0x0036: 0x36,
  0x0037: 0x37,
  0x0038: 0x38,
  0x0039: 0x39,
  0x003a: 0x3a,
  0x003b: 0x3b,
  0x003c: 0x3c,
  0x003d: 0x3d,
  0x003e: 0x3e,
  0x003f: 0x3f,
  0x0040: 0x40,
  0x0041: 0x41,
  0x0042: 0x42,
  0x0043: 0x43,
  0x0044: 0x44,
  0x0045: 0x45,
  0x0046: 0x46,
  0x0047: 0x47,
  0x0048: 0x48,
  0x0049: 0x49,
  0x004a: 0x4a,
  0x004b: 0x4b,
  0x004c: 0x4c,
  0x004d: 0x4d,
  0x004e: 0x4e,
  0x004f: 0x4f,
  0x0050: 0x50,
  0x0051: 0x51,
  0x0052: 0x52,
  0x0053: 0x53,
  0x0054: 0x54,
  0x0055: 0x55,
  0x0056: 0x56,
  0x0057: 0x57,
  0x0058: 0x58,
  0x0059: 0x59,
  0x005a: 0x5a,
  0x005b: 0x5b,
  0x005c: 0x5c,
  0x005d: 0x5d,
  0x005e: 0x5e,
  0x005f: 0x5f,
  0x0060: 0x60,
  0x0061: 0x61,
  0x0062: 0x62,
  0x0063: 0x63,
  0x0064: 0x64,
  0x0065: 0x65,
  0x0066: 0x66,
  0x0067: 0x67,
  0x0068: 0x68,
  0x0069: 0x69,
  0x006a: 0x6a,
  0x006b: 0x6b,
  0x006c: 0x6c,
  0x006d: 0x6d,
  0x006e: 0x6e,
  0x006f: 0x6f,
  0x0070: 0x70,
  0x0071: 0x71,
  0x0072: 0x72,
  0x0073: 0x73,
  0x0074: 0x74,
  0x0075: 0x75,
  0x0076: 0x76,
  0x0077: 0x77,
  0x0078: 0x78,
  0x0079: 0x79,
  0x007a: 0x7a,
  0x007b: 0x7b,
  0x007c: 0x7c,
  0x007d: 0x7d,
  0x007e: 0x7e,
  0x007f: 0x7f,
  0x0098: 0x98,
  0x00a0: 0xa0,
  0x00a4: 0xa4,
  0x00a6: 0xa6,
  0x00a7: 0xa7,
  0x00a9: 0xa9,
  0x00ab: 0xab,
  0x00ac: 0xac,
  0x00ad: 0xad,
  0x00ae: 0xae,
  0x00b0: 0xb0,
  0x00b1: 0xb1,
  0x00b5: 0xb5,
  0x00b6: 0xb6,
  0x00b7: 0xb7,
  0x00bb: 0xbb,
  0x00c0: 0x41,
  0x00c1: 0x41,
  0x00c2: 0x41,
  0x00c3: 0x41,
  0x00c4: 0x41,
  0x00c5: 0x41,
  0x00c7: 0x43,
  0x00c8: 0x45,
  0x00c9: 0x45,
  0x00ca: 0x45,
  0x00cb: 0x45,
  0x00cc: 0x49,
  0x00cd: 0x49,
  0x00ce: 0x49,
  0x00cf: 0x49,
  0x00d1: 0x4e,
  0x00d2: 0x4f,
  0x00d3: 0x4f,
  0x00d4: 0x4f,
  0x00d5: 0x4f,
  0x00d6: 0x4f,
  0x00d8: 0x4f,
  0x00d9: 0x55,
  0x00da: 0x55,
  0x00db: 0x55,
  0x00dc: 0x55,
  0x00dd: 0x59,
  0x00e0: 0x61,
  0x00e1: 0x61,
  0x00e2: 0x61,
  0x00e3: 0x61,
  0x00e4: 0x61,
  0x00e5: 0x61,
  0x00e7: 0x63,
  0x00e8: 0x65,
  0x00e9: 0x65,
  0x00ea: 0x65,
  0x00eb: 0x65,
  0x00ec: 0x69,
  0x00ed: 0x69,
  0x00ee: 0x69,
  0x00ef: 0x69,
  0x00f1: 0x6e,
  0x00f2: 0x6f,
  0x00f3: 0x6f,
  0x00f4: 0x6f,
  0x00f5: 0x6f,
  0x00f6: 0x6f,
  0x00f8: 0x6f,
  0x00f9: 0x75,
  0x00fa: 0x75,
  0x00fb: 0x75,
  0x00fc: 0x75,
  0x00fd: 0x79,
  0x00ff: 0x79,
  0x0100: 0x41,
  0x0101: 0x61,
  0x0102: 0x41,
  0x0103: 0x61,
  0x0104: 0x41,
  0x0105: 0x61,
  0x0106: 0x43,
  0x0107: 0x63,
  0x0108: 0x43,
  0x0109: 0x63,
  0x010a: 0x43,
  0x010b: 0x63,
  0x010c: 0x43,
  0x010d: 0x63,
  0x010e: 0x44,
  0x010f: 0x64,
  0x0110: 0x44,
  0x0111: 0x64,
  0x0112: 0x45,
  0x0113: 0x65,
  0x0114: 0x45,
  0x0115: 0x65,
  0x0116: 0x45,
  0x0117: 0x65,
  0x0118: 0x45,
  0x0119: 0x65,
  0x011a: 0x45,
  0x011b: 0x65,
  0x011c: 0x47,
  0x011d: 0x67,
  0x011e: 0x47,
  0x011f: 0x67,
  0x0120: 0x47,
  0x0121: 0x67,
  0x0122: 0x47,
  0x0123: 0x67,
  0x0124: 0x48,
  0x0125: 0x68,
  0x0126: 0x48,
  0x0127: 0x68,
  0x0128: 0x49,
  0x0129: 0x69,
  0x012a: 0x49,
  0x012b: 0x69,
  0x012c: 0x49,
  0x012d: 0x69,
  0x012e: 0x49,
  0x012f: 0x69,
  0x0130: 0x49,
  0x0134: 0x4a,
  0x0135: 0x6a,
  0x0136: 0x4b,
  0x0137: 0x6b,
  0x0139: 0x4c,
  0x013a: 0x6c,
  0x013b: 0x4c,
  0x013c: 0x6c,
  0x013d: 0x4c,
  0x013e: 0x6c,
  0x0141: 0x4c,
  0x0142: 0x6c,
  0x0143: 0x4e,
  0x0144: 0x6e,
  0x0145: 0x4e,
  0x0146: 0x6e,
  0x0147: 0x4e,
  0x0148: 0x6e,
  0x014c: 0x4f,
  0x014d: 0x6f,
  0x014e: 0x4f,
  0x014f: 0x6f,
  0x0150: 0x4f,
  0x0151: 0x6f,
  0x0154: 0x52,
  0x0155: 0x72,
  0x0156: 0x52,
  0x0157: 0x72,
  0x0158: 0x52,
  0x0159: 0x72,
  0x015a: 0x53,
  0x015b: 0x73,
  0x015c: 0x53,
  0x015d: 0x73,
  0x015e: 0x53,
  0x015f: 0x73,
  0x0160: 0x53,
  0x0161: 0x73,
  0x0162: 0x54,
  0x0163: 0x74,
  0x0164: 0x54,
  0x0165: 0x74,
  0x0166: 0x54,
  0x0167: 0x74,
  0x0168: 0x55,
  0x0169: 0x75,
  0x016a: 0x55,
  0x016b: 0x75,
  0x016c: 0x55,
  0x016d: 0x75,
  0x016e: 0x55,
  0x016f: 0x75,
  0x0170: 0x55,
  0x0171: 0x75,
  0x0172: 0x55,
  0x0173: 0x75,
  0x0174: 0x57,
  0x0175: 0x77,
  0x0176: 0x59,
  0x0177: 0x79,
  0x0178: 0x59,
  0x0179: 0x5a,
  0x017a: 0x7a,
  0x017b: 0x5a,
  0x017c: 0x7a,
  0x017d: 0x5a,
  0x017e: 0x7a,
  0x0180: 0x62,
  0x0197: 0x49,
  0x019a: 0x6c,
  0x019f: 0x4f,
  0x01a0: 0x4f,
  0x01a1: 0x6f,
  0x01ab: 0x74,
  0x01ae: 0x54,
  0x01af: 0x55,
  0x01b0: 0x75,
  0x01cd: 0x41,
  0x01ce: 0x61,
  0x01cf: 0x49,
  0x01d0: 0x69,
  0x01d1: 0x4f,
  0x01d2: 0x6f,
  0x01d3: 0x55,
  0x01d4: 0x75,
  0x01d5: 0x55,
  0x01d6: 0x75,
  0x01d7: 0x55,
  0x01d8: 0x75,
  0x01d9: 0x55,
  0x01da: 0x75,
  0x01db: 0x55,
  0x01dc: 0x75,
  0x01de: 0x41,
  0x01df: 0x61,
  0x01e4: 0x47,
  0x01e5: 0x67,
  0x01e6: 0x47,
  0x01e7: 0x67,
  0x01e8: 0x4b,
  0x01e9: 0x6b,
  0x01ea: 0x4f,
  0x01eb: 0x6f,
  0x01ec: 0x4f,
  0x01ed: 0x6f,
  0x01f0: 0x6a,
  0x0401: 0xa8,
  0x0402: 0x80,
  0x0403: 0x81,
  0x0404: 0xaa,
  0x0405: 0xbd,
  0x0406: 0xb2,
  0x0407: 0xaf,
  0x0408: 0xa3,
  0x0409: 0x8a,
  0x040a: 0x8c,
  0x040b: 0x8e,
  0x040c: 0x8d,
  0x040e: 0xa1,
  0x040f: 0x8f,
  0x0410: 0xc0,
  0x0411: 0xc1,
  0x0412: 0xc2,
  0x0413: 0xc3,
  0x0414: 0xc4,
  0x0415: 0xc5,
  0x0416: 0xc6,
  0x0417: 0xc7,
  0x0418: 0xc8,
  0x0419: 0xc9,
  0x041a: 0xca,
  0x041b: 0xcb,
  0x041c: 0xcc,
  0x041d: 0xcd,
  0x041e: 0xce,
  0x041f: 0xcf,
  0x0420: 0xd0,
  0x0421: 0xd1,
  0x0422: 0xd2,
  0x0423: 0xd3,
  0x0424: 0xd4,
  0x0425: 0xd5,
  0x0426: 0xd6,
  0x0427: 0xd7,
  0x0428: 0xd8,
  0x0429: 0xd9,
  0x042a: 0xda,
  0x042b: 0xdb,
  0x042c: 0xdc,
  0x042d: 0xdd,
  0x042e: 0xde,
  0x042f: 0xdf,
  0x0430: 0xe0,
  0x0431: 0xe1,
  0x0432: 0xe2,
  0x0433: 0xe3,
  0x0434: 0xe4,
  0x0435: 0xe5,
  0x0436: 0xe6,
  0x0437: 0xe7,
  0x0438: 0xe8,
  0x0439: 0xe9,
  0x043a: 0xea,
  0x043b: 0xeb,
  0x043c: 0xec,
  0x043d: 0xed,
  0x043e: 0xee,
  0x043f: 0xef,
  0x0440: 0xf0,
  0x0441: 0xf1,
  0x0442: 0xf2,
  0x0443: 0xf3,
  0x0444: 0xf4,
  0x0445: 0xf5,
  0x0446: 0xf6,
  0x0447: 0xf7,
  0x0448: 0xf8,
  0x0449: 0xf9,
  0x044a: 0xfa,
  0x044b: 0xfb,
  0x044c: 0xfc,
  0x044d: 0xfd,
  0x044e: 0xfe,
  0x044f: 0xff,
  0x0451: 0xb8,
  0x0452: 0x90,
  0x0453: 0x83,
  0x0454: 0xba,
  0x0455: 0xbe,
  0x0456: 0xb3,
  0x0457: 0xbf,
  0x0458: 0xbc,
  0x0459: 0x9a,
  0x045a: 0x9c,
  0x045b: 0x9e,
  0x045c: 0x9d,
  0x045e: 0xa2,
  0x045f: 0x9f,
  0x0490: 0xa5,
  0x0491: 0xb4,
  0x2013: 0x96,
  0x2014: 0x97,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201a: 0x82,
  0x201c: 0x93,
  0x201d: 0x94,
  0x201e: 0x84,
  0x2020: 0x86,
  0x2021: 0x87,
  0x2022: 0x95,
  0x2026: 0x85,
  0x2030: 0x89,
  0x2039: 0x8b,
  0x203a: 0x9b,
  0x203c: 0x21,
  0x20ac: 0x88,
  0x2116: 0xb9,
  0x2122: 0x99,
  0x2190: 0x3c,
  0x2191: 0x5e,
  0x2192: 0x3e,
  0x2193: 0x76,
  0x2194: 0x2d,
  0x2195: 0xa6,
  0x21a8: 0xa6,
  0x2219: 0x95,
  0x221a: 0x76,
  0x221f: 0x4c,
  0x2302: 0xa6,
  0x2500: 0x2d,
  0x2502: 0xa6,
  0x250c: 0x2d,
  0x2510: 0xac,
  0x2514: 0x4c,
  0x2518: 0x2d,
  0x251c: 0x2b,
  0x2524: 0x2b,
  0x252c: 0x54,
  0x2534: 0x2b,
  0x253c: 0x2b,
  0x2550: 0x3d,
  0x2551: 0xa6,
  0x2552: 0x2d,
  0x2553: 0xe3,
  0x2554: 0xe3,
  0x2555: 0xac,
  0x2556: 0xac,
  0x2557: 0xac,
  0x2558: 0x4c,
  0x2559: 0x4c,
  0x255a: 0x4c,
  0x255b: 0x2d,
  0x255c: 0x2d,
  0x255d: 0x2d,
  0x255e: 0xa6,
  0x255f: 0xa6,
  0x2560: 0xa6,
  0x2561: 0xa6,
  0x2562: 0xa6,
  0x2563: 0xa6,
  0x2564: 0x54,
  0x2565: 0x54,
  0x2566: 0x54,
  0x2567: 0xa6,
  0x2568: 0xa6,
  0x2569: 0xa6,
  0x256a: 0x2b,
  0x256b: 0x2b,
  0x256c: 0x2b,
  0x2580: 0x2d,
  0x2584: 0x2d,
  0x2588: 0x2d,
  0x258c: 0xa6,
  0x2590: 0xa6,
  0x2591: 0x2d,
  0x2592: 0x2d,
  0x2593: 0x2d,
  0x25a0: 0xa6,
  0x25ac: 0x2d,
  0x25b2: 0x5e,
  0x25ba: 0x3e,
  0x25bc: 0xa1,
  0x25c4: 0x3c,
  0x25cb: 0x30,
  0x25d8: 0x95,
  0x25d9: 0x30,
  0x263a: 0x4f,
  0x263b: 0x4f,
  0x263c: 0x30,
  0x2640: 0x2b,
  0x2642: 0x3e,
  0x2660: 0xa6,
  0x2663: 0xa6,
  0x2665: 0xa6,
  0x2666: 0xa6,
  0x266a: 0x64,
  0x266b: 0x64,
  0xff01: 0x21,
  0xff02: 0x22,
  0xff03: 0x23,
  0xff04: 0x24,
  0xff05: 0x25,
  0xff06: 0x26,
  0xff07: 0x27,
  0xff08: 0x28,
  0xff09: 0x29,
  0xff0a: 0x2a,
  0xff0b: 0x2b,
  0xff0c: 0x2c,
  0xff0d: 0x2d,
  0xff0e: 0x2e,
  0xff0f: 0x2f,
  0xff10: 0x30,
  0xff11: 0x31,
  0xff12: 0x32,
  0xff13: 0x33,
  0xff14: 0x34,
  0xff15: 0x35,
  0xff16: 0x36,
  0xff17: 0x37,
  0xff18: 0x38,
  0xff19: 0x39,
  0xff1a: 0x3a,
  0xff1b: 0x3b,
  0xff1c: 0x3c,
  0xff1d: 0x3d,
  0xff1e: 0x3e,
  0xff1f: 0x3f,
  0xff20: 0x40,
  0xff21: 0x41,
  0xff22: 0x42,
  0xff23: 0x43,
  0xff24: 0x44,
  0xff25: 0x45,
  0xff26: 0x46,
  0xff27: 0x47,
  0xff28: 0x48,
  0xff29: 0x49,
  0xff2a: 0x4a,
  0xff2b: 0x4b,
  0xff2c: 0x4c,
  0xff2d: 0x4d,
  0xff2e: 0x4e,
  0xff2f: 0x4f,
  0xff30: 0x50,
  0xff31: 0x51,
  0xff32: 0x52,
  0xff33: 0x53,
  0xff34: 0x54,
  0xff35: 0x55,
  0xff36: 0x56,
  0xff37: 0x57,
  0xff38: 0x58,
  0xff39: 0x59,
  0xff3a: 0x5a,
  0xff3b: 0x5b,
  0xff3c: 0x5c,
  0xff3d: 0x5d,
  0xff3e: 0x5e,
  0xff3f: 0x5f,
  0xff40: 0x60,
  0xff41: 0x61,
  0xff42: 0x62,
  0xff43: 0x63,
  0xff44: 0x64,
  0xff45: 0x65,
  0xff46: 0x66,
  0xff47: 0x67,
  0xff48: 0x68,
  0xff49: 0x69,
  0xff4a: 0x6a,
  0xff4b: 0x6b,
  0xff4c: 0x6c,
  0xff4d: 0x6d,
  0xff4e: 0x6e,
  0xff4f: 0x6f,
  0xff50: 0x70,
  0xff51: 0x71,
  0xff52: 0x72,
  0xff53: 0x73,
  0xff54: 0x74,
  0xff55: 0x75,
  0xff56: 0x76,
  0xff57: 0x77,
  0xff58: 0x78,
  0xff59: 0x79,
  0xff5a: 0x7a,
  0xff5b: 0x7b,
  0xff5c: 0x7c,
  0xff5d: 0x7d,
  0xff5e: 0x7e,
};

export const bestfit1251 = new Codepage(charmapCP1251, wcTableBestfit1251);