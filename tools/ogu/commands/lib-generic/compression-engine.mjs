/**
 * Compression Engine — simple LZ-style dictionary compression.
 */
export function createCompressionEngine() {
  let totalCompressed = 0;
  let totalOriginal = 0;

  function compress(input) {
    totalOriginal += input.length;
    const dict = {};
    let dictSize = 256;
    let w = "";
    const result = [];
    for (const ch of input) {
      const wc = w + ch;
      if (dict[wc] !== undefined || wc.length === 1) {
        w = wc;
      } else {
        result.push(w.length === 1 ? w.charCodeAt(0) : dict[w]);
        dict[wc] = dictSize++;
        w = ch;
      }
    }
    if (w) result.push(w.length === 1 ? w.charCodeAt(0) : dict[w]);
    const compressed = JSON.stringify(result);
    totalCompressed += compressed.length;
    return compressed;
  }

  function decompress(compressed) {
    const codes = JSON.parse(compressed);
    const dict = {};
    let dictSize = 256;
    let w = String.fromCharCode(codes[0]);
    const result = [w];
    for (let i = 1; i < codes.length; i++) {
      let entry;
      if (typeof codes[i] === "number" && codes[i] < 256) {
        entry = String.fromCharCode(codes[i]);
      } else if (dict[codes[i]] !== undefined) {
        entry = dict[codes[i]];
      } else if (codes[i] === dictSize) {
        entry = w + w[0];
      } else {
        throw new Error("bad compressed data");
      }
      result.push(entry);
      dict[dictSize++] = w + entry[0];
      w = entry;
    }
    return result.join("");
  }

  function getStats() {
    return { totalCompressed, totalOriginal };
  }

  return { compress, decompress, getStats };
}
