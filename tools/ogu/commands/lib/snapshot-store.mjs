/**
 * Snapshot Store — persist and load system snapshots to disk.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Create a snapshot store.
 *
 * @param {{ dir: string }} opts
 * @returns {object} Store with save/load/list/delete
 */
export function createSnapshotStore({ dir }) {
  function ensureDir() {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  async function save(id, state) {
    ensureDir();
    const path = join(dir, `${id}.snapshot.json`);
    writeFileSync(path, JSON.stringify({ id, state, savedAt: new Date().toISOString() }, null, 2));
    return id;
  }

  async function load(id) {
    const path = join(dir, `${id}.snapshot.json`);
    if (!existsSync(path)) return null;
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return data.state;
  }

  async function list() {
    ensureDir();
    return readdirSync(dir)
      .filter(f => f.endsWith('.snapshot.json'))
      .map(f => f.replace('.snapshot.json', ''));
  }

  async function del(id) {
    const path = join(dir, `${id}.snapshot.json`);
    if (existsSync(path)) unlinkSync(path);
  }

  return { save, load, list, delete: del };
}
