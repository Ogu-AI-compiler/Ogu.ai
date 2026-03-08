/**
 * Bit Vector — compact array of bits with set/get/clear operations.
 */
export function createBitVector(size) {
  const buffer = new Uint32Array(Math.ceil(size / 32));

  function set(index) {
    const word = index >> 5;
    const bit = index & 31;
    buffer[word] |= (1 << bit);
  }

  function clear(index) {
    const word = index >> 5;
    const bit = index & 31;
    buffer[word] &= ~(1 << bit);
  }

  function get(index) {
    const word = index >> 5;
    const bit = index & 31;
    return (buffer[word] & (1 << bit)) !== 0;
  }

  function popcount() {
    let count = 0;
    for (let i = 0; i < buffer.length; i++) {
      let v = buffer[i];
      v = v - ((v >> 1) & 0x55555555);
      v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
      count += (((v + (v >> 4)) & 0x0F0F0F0F) * 0x01010101) >> 24;
    }
    return count;
  }

  return { set, clear, get, popcount };
}
