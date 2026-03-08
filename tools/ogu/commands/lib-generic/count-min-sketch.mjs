/**
 * Count-Min Sketch — probabilistic frequency estimation.
 */

import { createHash } from "node:crypto";

export function createCountMinSketch({ width = 100, depth = 3 } = {}) {
  const table = [];
  for (let i = 0; i < depth; i++) {
    table.push(new Int32Array(width));
  }

  function getHashes(item) {
    const hashes = [];
    for (let i = 0; i < depth; i++) {
      const h = createHash("sha256").update(`${i}:${item}`).digest();
      hashes.push(h.readUInt32BE(0) % width);
    }
    return hashes;
  }

  function add(item, count = 1) {
    const hashes = getHashes(String(item));
    for (let i = 0; i < depth; i++) {
      table[i][hashes[i]] += count;
    }
  }

  function estimate(item) {
    const hashes = getHashes(String(item));
    let min = Infinity;
    for (let i = 0; i < depth; i++) {
      min = Math.min(min, table[i][hashes[i]]);
    }
    return min;
  }

  return { add, estimate };
}
