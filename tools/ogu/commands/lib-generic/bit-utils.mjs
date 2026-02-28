/**
 * Bit Manipulation Utils — common bitwise operations.
 */
export function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

export function nextPowerOfTwo(n) {
  if (isPowerOfTwo(n)) return n;
  let v = n - 1;
  v |= v >> 1; v |= v >> 2; v |= v >> 4;
  v |= v >> 8; v |= v >> 16;
  return v + 1;
}

export function countBits(n) {
  let count = 0;
  let v = n;
  while (v) { count += v & 1; v >>= 1; }
  return count;
}

export function highestBit(n) {
  if (n === 0) return 0;
  let v = n;
  v |= v >> 1; v |= v >> 2; v |= v >> 4;
  v |= v >> 8; v |= v >> 16;
  return (v + 1) >> 1;
}
