/**
 * Integrity Checker — verify file integrity against known hashes.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

function computeHash(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/**
 * Create an integrity checker.
 *
 * @returns {object} Checker with register/verify/verifyAll/getManifest
 */
export function createIntegrityChecker() {
  const manifest = {}; // path → hash

  function register(filePath) {
    manifest[filePath] = computeHash(filePath);
  }

  function verify(filePath) {
    const expected = manifest[filePath];
    if (!expected) return { valid: false, error: 'not registered' };
    const actual = computeHash(filePath);
    return { valid: actual === expected, expected, actual };
  }

  function verifyAll() {
    let passed = 0, failed = 0;
    const results = [];
    for (const filePath of Object.keys(manifest)) {
      const r = verify(filePath);
      if (r.valid) passed++;
      else failed++;
      results.push({ filePath, ...r });
    }
    return { total: Object.keys(manifest).length, passed, failed, results };
  }

  function getManifest() {
    return { ...manifest };
  }

  return { register, verify, verifyAll, getManifest };
}
