/**
 * Consistent Hasher — consistent hashing for distributed routing.
 */

import { createHash } from "node:crypto";

export function createConsistentHasher({ replicas = 100 } = {}) {
  const ring = new Map(); // hash → node
  let sortedKeys = [];
  const nodes = new Set();

  function hash(key) {
    return parseInt(createHash("md5").update(key).digest("hex").slice(0, 8), 16);
  }

  function rebuild() {
    sortedKeys = [...ring.keys()].sort((a, b) => a - b);
  }

  function addNode(node) {
    nodes.add(node);
    for (let i = 0; i < replicas; i++) {
      const h = hash(`${node}:${i}`);
      ring.set(h, node);
    }
    rebuild();
  }

  function removeNode(node) {
    nodes.delete(node);
    for (let i = 0; i < replicas; i++) {
      const h = hash(`${node}:${i}`);
      ring.delete(h);
    }
    rebuild();
  }

  function getNode(key) {
    if (sortedKeys.length === 0) return null;
    const h = hash(key);
    for (const k of sortedKeys) {
      if (k >= h) return ring.get(k);
    }
    return ring.get(sortedKeys[0]); // wrap around
  }

  return { addNode, removeNode, getNode };
}
