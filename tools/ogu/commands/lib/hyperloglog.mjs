/**
 * HyperLogLog — probabilistic cardinality estimation.
 */
export function createHyperLogLog(m) {
  const registers = new Uint8Array(m);
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h >>> 0;
  }
  function countLeadingZeros(val) {
    if (val === 0) return 32;
    let n = 0;
    while ((val & (1 << (31 - n))) === 0) n++;
    return n;
  }
  function add(item) {
    const h = hash(String(item));
    const idx = h % m;
    const w = Math.floor(h / m);
    registers[idx] = Math.max(registers[idx], countLeadingZeros(w) + 1);
  }
  function estimate() {
    const alpha = 0.7213 / (1 + 1.079 / m);
    let sum = 0;
    let zeros = 0;
    for (let i = 0; i < m; i++) {
      sum += Math.pow(2, -registers[i]);
      if (registers[i] === 0) zeros++;
    }
    let est = alpha * m * m / sum;
    if (est <= 2.5 * m && zeros > 0) {
      est = m * Math.log(m / zeros);
    }
    return Math.round(est);
  }
  return { add, estimate };
}
