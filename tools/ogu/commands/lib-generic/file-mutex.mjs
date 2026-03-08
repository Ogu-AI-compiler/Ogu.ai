import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

/**
 * File Mutex — runtime file locking for build-parallel.
 *
 * Prevents multiple tasks from modifying the same file concurrently.
 * Locks stored in .ogu/locks/files/{sanitized-path}.json.
 */

function lockDir(root) {
  const dir = join(root, '.ogu/locks/files');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function lockKey(filePath) {
  return filePath.replace(/[/\\]/g, '__');
}

/**
 * Acquire a file-level lock.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} opts.filePath - Relative file path
 * @param {string} opts.taskId
 * @param {string} opts.roleId
 * @returns {{ id, filePath, taskId, roleId, acquiredAt }}
 * @throws If file is already locked by another task
 */
export function acquireFileLock({ root, filePath, taskId, roleId } = {}) {
  root = root || repoRoot();
  const dir = lockDir(root);
  const key = lockKey(filePath);
  const lockPath = join(dir, `${key}.json`);

  if (existsSync(lockPath)) {
    const existing = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (existing.taskId !== taskId) {
      throw new Error(`File "${filePath}" is locked by task ${existing.taskId} (conflict)`);
    }
    return existing; // Re-acquire by same task
  }

  const lock = {
    id: randomUUID(),
    filePath,
    taskId,
    roleId,
    acquiredAt: new Date().toISOString(),
  };

  writeFileSync(lockPath, JSON.stringify(lock, null, 2));
  return lock;
}

/**
 * Release a file-level lock.
 */
export function releaseFileLock({ root, filePath, taskId } = {}) {
  root = root || repoRoot();
  const dir = lockDir(root);
  const key = lockKey(filePath);
  const lockPath = join(dir, `${key}.json`);

  if (existsSync(lockPath)) {
    const existing = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (existing.taskId === taskId) {
      unlinkSync(lockPath);
      return true;
    }
  }
  return false;
}

/**
 * List all active file locks.
 */
export function listFileLocks({ root } = {}) {
  root = root || repoRoot();
  const dir = lockDir(root);
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; }
    })
    .filter(Boolean);
}

/**
 * Release all locks held by a specific task.
 */
export function releaseAllLocks({ root, taskId } = {}) {
  root = root || repoRoot();
  const dir = lockDir(root);
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));

  for (const f of files) {
    try {
      const lock = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      if (lock.taskId === taskId) {
        unlinkSync(join(dir, f));
      }
    } catch { /* skip */ }
  }
}
