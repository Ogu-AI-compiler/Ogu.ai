import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

/**
 * Time Travel — snapshot and delta reconstruction for state replay.
 *
 * Captures state snapshots at key points and enables reconstruction
 * of state at any previous snapshot. Read-only replay mode.
 * Stored in .ogu/snapshots/{id}.json.
 */

function snapshotDir(root) {
  const dir = join(root, '.ogu/snapshots');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Save a state snapshot.
 */
export function saveSnapshot({ root, label, state } = {}) {
  root = root || repoRoot();
  const dir = snapshotDir(root);

  const snapshot = {
    id: randomUUID(),
    label: label || 'unnamed',
    state: state || {},
    timestamp: new Date().toISOString(),
  };

  writeFileSync(join(dir, `${snapshot.id}.json`), JSON.stringify(snapshot, null, 2));
  return { id: snapshot.id, label: snapshot.label, timestamp: snapshot.timestamp };
}

/**
 * List all snapshots ordered by timestamp.
 */
export function listSnapshots({ root } = {}) {
  root = root || repoRoot();
  const dir = snapshotDir(root);

  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        return { id: data.id, label: data.label, timestamp: data.timestamp };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Load a full snapshot by ID.
 */
export function loadSnapshot({ root, id } = {}) {
  root = root || repoRoot();
  const p = join(snapshotDir(root), `${id}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

/**
 * Compute delta between two snapshots.
 */
export function computeDelta({ root, fromId, toId } = {}) {
  root = root || repoRoot();
  const from = loadSnapshot({ root, id: fromId });
  const to = loadSnapshot({ root, id: toId });

  if (!from || !to) return null;

  const changes = [];
  const allKeys = new Set([...Object.keys(from.state), ...Object.keys(to.state)]);

  for (const key of allKeys) {
    const fromVal = JSON.stringify(from.state[key]);
    const toVal = JSON.stringify(to.state[key]);

    if (fromVal !== toVal) {
      changes.push({
        key,
        from: from.state[key],
        to: to.state[key],
        type: fromVal === undefined ? 'added' : toVal === undefined ? 'removed' : 'changed',
      });
    }
  }

  return {
    fromId,
    toId,
    fromLabel: from.label,
    toLabel: to.label,
    changes,
  };
}

/**
 * Replay state at a given snapshot — returns the state at that point.
 */
export function replayTo({ root, snapshotId } = {}) {
  root = root || repoRoot();
  const snap = loadSnapshot({ root, id: snapshotId });
  if (!snap) return null;
  return snap.state;
}
