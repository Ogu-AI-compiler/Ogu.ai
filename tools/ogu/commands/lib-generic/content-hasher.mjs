/**
 * Content Hasher — hash files/strings with multiple algorithms.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Hash a string.
 *
 * @param {string} content
 * @param {{ algorithm?: string }} opts
 * @returns {string} Hex hash
 */
export function hashString(content, { algorithm = 'sha256' } = {}) {
  return createHash(algorithm).update(content).digest('hex');
}

/**
 * Hash a file's contents.
 *
 * @param {string} filePath
 * @param {{ algorithm?: string }} opts
 * @returns {string} Hex hash
 */
export function hashFile(filePath, { algorithm = 'sha256' } = {}) {
  const content = readFileSync(filePath);
  return createHash(algorithm).update(content).digest('hex');
}
