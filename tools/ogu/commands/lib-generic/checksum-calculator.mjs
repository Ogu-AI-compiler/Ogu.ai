/**
 * Checksum Calculator — CRC32 and Adler32 checksums.
 */
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}

export function crc32(input) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < input.length; i++) {
    crc = crcTable[(crc ^ input.charCodeAt(i)) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function adler32(input) {
  let a = 1, b = 0;
  for (let i = 0; i < input.length; i++) {
    a = (a + input.charCodeAt(i)) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}
