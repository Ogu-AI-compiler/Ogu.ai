/**
 * Bloom Filter — probabilistic set membership test.
 */

import { createHash } from "node:crypto";

export function createBloomFilter({ size = 1024, hashCount = 3 } = {}) {
  const bits = new Uint8Array(size);
  let itemsAdded = 0;

  function getHashes(item) {
    const hashes = [];
    for (let i = 0; i < hashCount; i++) {
      const h = createHash("sha256").update(`${i}:${item}`).digest();
      const idx = (h.readUInt32BE(0) % size);
      hashes.push(idx);
    }
    return hashes;
  }

  function add(item) {
    for (const idx of getHashes(String(item))) {
      bits[idx] = 1;
    }
    itemsAdded++;
  }

  function mightContain(item) {
    for (const idx of getHashes(String(item))) {
      if (bits[idx] === 0) return false;
    }
    return true;
  }

  function getStats() {
    return { itemsAdded, size, hashCount };
  }

  return { add, mightContain, getStats };
}
