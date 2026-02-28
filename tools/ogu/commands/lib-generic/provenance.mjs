/**
 * Provenance — input→process→output chain tracking with hash linking.
 */

import { createHash } from 'node:crypto';

function hashEntry(entry, previousHash) {
  const data = JSON.stringify({ input: entry.input, process: entry.process, output: entry.output, previousHash });
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

/**
 * Create a provenance chain tracker.
 *
 * @returns {object} Chain with record/verify/getChain/getLineage
 */
export function createProvenanceChain() {
  const entries = [];

  function record({ input, process, output }) {
    const previousHash = entries.length > 0 ? entries[entries.length - 1].hash : null;
    const entry = {
      input,
      process,
      output,
      previousHash,
      timestamp: new Date().toISOString(),
    };
    entry.hash = hashEntry(entry, previousHash);
    entries.push(entry);
  }

  function verify() {
    for (let i = 0; i < entries.length; i++) {
      const expected = hashEntry(entries[i], entries[i].previousHash);
      if (entries[i].hash !== expected) return false;
      if (i > 0 && entries[i].previousHash !== entries[i - 1].hash) return false;
    }
    return true;
  }

  function getChain() {
    return [...entries];
  }

  function getLineage(output) {
    const result = [];
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].output === output || (result.length > 0 && entries[i].output === result[result.length - 1].input)) {
        result.push(entries[i]);
      }
    }
    return result.reverse();
  }

  return { record, verify, getChain, getLineage };
}
