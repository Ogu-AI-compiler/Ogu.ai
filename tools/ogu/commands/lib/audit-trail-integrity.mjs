/**
 * Audit Trail Integrity — verify audit log chain integrity with hash chaining.
 */

import { createHash } from "node:crypto";

function computeHash(data, prevHash) {
  const h = createHash("sha256");
  h.update(JSON.stringify(data));
  h.update(prevHash || "genesis");
  return h.digest("hex");
}

export function createAuditChain() {
  const entries = [];

  function append(data) {
    const index = entries.length;
    const prevHash = index > 0 ? entries[index - 1].hash : null;
    const hash = computeHash(data, prevHash);
    const entry = {
      index,
      data,
      hash,
      prevHash,
      timestamp: Date.now(),
    };
    entries.push(entry);
    return entry;
  }

  function verify() {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const prevHash = i > 0 ? entries[i - 1].hash : null;
      const expected = computeHash(entry.data, prevHash);
      if (entry.hash !== expected) return false;
      if (i > 0 && entry.prevHash !== entries[i - 1].hash) return false;
    }
    return true;
  }

  function getEntries() {
    return entries;
  }

  return { append, verify, getEntries };
}
