import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * State Compaction — compact large JSONL files.
 *
 * Removes duplicate entries keeping only the latest per key.
 * Useful for compacting audit logs, transaction logs, etc.
 */

/**
 * Compact a JSONL file by keeping only the latest entry per key.
 *
 * @param {object} opts
 * @param {string} opts.filePath - Absolute path to JSONL file
 * @param {string} opts.keyField - Field name to use as dedup key
 * @returns {{ before: number, after: number, removed: number }}
 */
export function compactJSONL({ filePath, keyField } = {}) {
  if (!existsSync(filePath)) return { before: 0, after: 0, removed: 0 };

  const content = readFileSync(filePath, 'utf8').trim();
  if (!content) return { before: 0, after: 0, removed: 0 };

  const lines = content.split('\n').filter(Boolean);
  const before = lines.length;

  // Keep latest entry per key
  const latest = new Map();
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const key = entry[keyField];
      if (key !== undefined) {
        latest.set(key, line);
      } else {
        // No key — always keep
        latest.set(`_nk_${latest.size}`, line);
      }
    } catch { /* skip bad lines */ }
  }

  const compacted = [...latest.values()];
  writeFileSync(filePath, compacted.join('\n') + '\n');

  return {
    before,
    after: compacted.length,
    removed: before - compacted.length,
  };
}

/**
 * Analyze compaction potential without modifying the file.
 *
 * @param {object} opts
 * @param {string} opts.filePath
 * @param {string} opts.keyField
 * @returns {{ totalEntries, uniqueKeys, duplicates, savingsPercent }}
 */
export function analyzeCompaction({ filePath, keyField } = {}) {
  if (!existsSync(filePath)) {
    return { totalEntries: 0, uniqueKeys: 0, duplicates: 0, savingsPercent: 0 };
  }

  const content = readFileSync(filePath, 'utf8').trim();
  if (!content) return { totalEntries: 0, uniqueKeys: 0, duplicates: 0, savingsPercent: 0 };

  const lines = content.split('\n').filter(Boolean);
  const keys = new Set();

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry[keyField] !== undefined) keys.add(entry[keyField]);
    } catch { /* skip */ }
  }

  const totalEntries = lines.length;
  const uniqueKeys = keys.size;
  const duplicates = totalEntries - uniqueKeys;
  const savingsPercent = totalEntries > 0
    ? Math.round((duplicates / totalEntries) * 100)
    : 0;

  return { totalEntries, uniqueKeys, duplicates, savingsPercent };
}
