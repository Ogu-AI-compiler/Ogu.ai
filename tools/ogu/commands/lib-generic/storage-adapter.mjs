/**
 * Storage Adapter — pluggable storage layer (filesystem backend).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const STORAGE_BACKENDS = ['filesystem', 'memory', 'sqlite', 's3'];

/**
 * Create a filesystem-backed storage adapter.
 *
 * @param {{ root: string }} opts
 * @returns {object} Storage with write/read/exists/remove/list
 */
export function createFileStorage({ root }) {
  function write(key, content) {
    const filePath = join(root, key);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, 'utf8');
  }

  function read(key) {
    const filePath = join(root, key);
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, 'utf8');
  }

  function exists(key) {
    return existsSync(join(root, key));
  }

  function remove(key) {
    const filePath = join(root, key);
    if (existsSync(filePath)) unlinkSync(filePath);
  }

  function list(prefix) {
    const dir = join(root, prefix);
    if (!existsSync(dir)) return [];
    return readdirSync(dir);
  }

  return { write, read, exists, remove, list };
}
