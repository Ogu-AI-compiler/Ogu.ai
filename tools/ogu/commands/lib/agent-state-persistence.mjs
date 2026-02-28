/**
 * Agent State Persistence — save/load per-agent state to disk.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_STATE = {
  roleId: '',
  tokensUsedToday: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  escalations: 0,
  lastActive: null,
};

/**
 * Create an agent state persistence manager.
 *
 * @param {{ dir: string }} opts - Directory to store agent state files
 * @returns {object} Manager with save/load/update/listAgents
 */
export function createAgentStatePersistence({ dir }) {
  function ensureDir() {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  function filePath(roleId) {
    return join(dir, `${roleId}.state.json`);
  }

  async function save(roleId, state) {
    ensureDir();
    writeFileSync(filePath(roleId), JSON.stringify(state, null, 2));
  }

  async function load(roleId) {
    const fp = filePath(roleId);
    if (!existsSync(fp)) {
      return { ...DEFAULT_STATE, roleId };
    }
    return JSON.parse(readFileSync(fp, 'utf-8'));
  }

  async function update(roleId, partial) {
    const current = await load(roleId);
    const merged = { ...current, ...partial };
    await save(roleId, merged);
  }

  async function listAgents() {
    ensureDir();
    return readdirSync(dir)
      .filter(f => f.endsWith('.state.json'))
      .map(f => f.replace('.state.json', ''));
  }

  return { save, load, update, listAgents };
}
