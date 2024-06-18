/**
 * @param {number} ch
 * @returns {boolean}
 */
function isCapital(ch) {
  return ch >= "A".charCodeAt(0) && ch <= "Z".charCodeAt(0);
}

/**
 * @param {number} ch
 * @returns {boolean}
 */
function isDigit(ch) {
  return ch >= "0".charCodeAt(0) && ch <= "9".charCodeAt(0);
}

export const NameUtil = {
  /**
   * @param {number} ch
   * @returns {boolean}
   */
  isCharValid(ch) {
    return ch > 127 || isCapital(ch) || isDigit(ch) || " $%'-_@~`!(){}^#&".includes(String.fromCharCode(ch));
  },

  /**
   * @param {!Uint8Array} arr
   * @returns {boolean}
   */
  isNameValid(arr) {
    let i = 0;
    while (i < arr.length && NameUtil.isCharValid(arr[i])) {
      i++;
    }
    return i === arr.length;
  },

  /**
   * @param {!Uint8Array} arr
   * @returns {number}
   */
  getChkSum(arr) {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum = (((sum & 1) === 1 ? 0x80 : 0) + (sum >> 1) + arr[i]) & 0xff;
    }
    return sum;
  },

  /**
   * @param {!Uint8Array} arr
   * @param {string} encoding
   * @returns {string}
   */
  getRawName(arr, encoding) {
    return new TextDecoder(encoding).decode(arr).trimEnd();
  },

  /**
   * @param {!Uint8Array} arr
   * @param {string} encoding
   * @returns {string}
   */
  getShortName(arr, encoding) {
    const filename = NameUtil.getRawName(arr.subarray(0, 8), encoding);
    const ext = NameUtil.getRawName(arr.subarray(8, 11), encoding);
    if (ext === "") {
      return filename;
    }
    return filename + "." + ext;
  },
};

export const DateUtil = {
  /**
   * @param {number} date
   * @returns {string}
   */
  formatDate: function (date) {
    if (date === 0) {
      return "";
    }
    const dayOfMonth = date & 0b11111;
    const monthOfYear = (date >> 5) & 0b1111;
    const yearSince1980 = (date >> 9) & 0b1111111;
    return 1980 + yearSince1980 + "." + monthOfYear.toString().padStart(2, "0") + "." + dayOfMonth.toString().padStart(2, "0");
  },

  /**
   * @param {number} time
   * @param {number} timeTenth
   * @returns {string}
   */
  formatTime: function (time, timeTenth) {
    if (time === 0) {
      return "";
    }
    // const millis = (timeTenth % 100) * 10;
    const seconds = Math.floor(timeTenth / 100) + ((time & 0b11111) << 1);
    const minutes = (time >> 5) & 0b111111;
    const hours = (time >> 11) & 0b11111;
    return hours.toString().padStart(2, "0") + ":" + minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0");
  },
};
