import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';
import { getCheckpointsDir } from './runtime-paths.mjs';

/**
 * Task Checkpoint — checkpoint/resume for individual tasks.
 *
 * Saves task progress so execution can resume after failure.
 * Stored in .ogu/checkpoints/{taskId}.json.
 */

function cpDir(root) {
  const dir = getCheckpointsDir(root);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Create a checkpoint for a task.
 */
export function createCheckpoint({ root, taskId, featureSlug, progress, state } = {}) {
  root = root || repoRoot();
  const dir = cpDir(root);

  const checkpoint = {
    id: randomUUID(),
    taskId,
    featureSlug,
    progress: progress || 0,
    state: state || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  writeFileSync(join(dir, `${taskId}.json`), JSON.stringify(checkpoint, null, 2));
  return checkpoint;
}

/**
 * Load a checkpoint for a task.
 */
export function loadCheckpoint({ root, taskId } = {}) {
  root = root || repoRoot();
  const p = join(cpDir(root), `${taskId}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

/**
 * Update an existing checkpoint.
 */
export function updateCheckpoint({ root, taskId, progress, state } = {}) {
  root = root || repoRoot();
  const existing = loadCheckpoint({ root, taskId });
  if (!existing) return null;

  if (progress !== undefined) existing.progress = progress;
  if (state !== undefined) existing.state = state;
  existing.updatedAt = new Date().toISOString();

  writeFileSync(join(cpDir(root), `${taskId}.json`), JSON.stringify(existing, null, 2));
  return existing;
}

/**
 * List all checkpoints.
 */
export function listCheckpoints({ root } = {}) {
  root = root || repoRoot();
  const dir = cpDir(root);
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; }
    })
    .filter(Boolean);
}

/**
 * Clear (remove) a checkpoint.
 */
export function clearCheckpoint({ root, taskId } = {}) {
  root = root || repoRoot();
  const p = join(cpDir(root), `${taskId}.json`);
  if (existsSync(p)) unlinkSync(p);
}
