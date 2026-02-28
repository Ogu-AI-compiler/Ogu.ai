/**
 * Morton Code (Z-order curve) — interleave bits of x and y coordinates.
 */
export function encode(x, y) {
  let code = 0;
  for (let i = 0; i < 16; i++) {
    code |= ((x & (1 << i)) << i) | ((y & (1 << i)) << (i + 1));
  }
  return code;
}

export function decode(code) {
  let x = 0, y = 0;
  for (let i = 0; i < 16; i++) {
    x |= ((code >> (2 * i)) & 1) << i;
    y |= ((code >> (2 * i + 1)) & 1) << i;
  }
  return [x, y];
}
