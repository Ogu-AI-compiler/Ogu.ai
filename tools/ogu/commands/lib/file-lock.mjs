import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';
import { getLocksDir } from './runtime-paths.mjs';

/**
 * Semantic File Lock — prevents concurrent writes to the same file by multiple agents.
 *
 * Storage: .ogu/locks/{lockId}.json
 *
 * Core functions:
 *   acquireLock({ files, roleId, taskId })  — Acquire lock on file paths
 *   releaseLock(taskId)                     — Release all locks held by a task
 *   checkLock(filePath)                     — Check if a file is locked
 *   listLocks()                             — List all active locks
 */

const LOCKS_DIR = () => getLocksDir(repoRoot());

/**
 * Acquire a lock on a set of file paths.
 *
 * @param {object} options
 * @param {string[]} options.files — File paths to lock
 * @param {string} options.roleId — Agent role requesting the lock
 * @param {string} options.taskId — Task ID requesting the lock
 * @returns {{ acquired: boolean, lockId?: string, reason?: string }}
 */
export function acquireLock({ files, roleId, taskId }) {
  const dir = LOCKS_DIR();
  mkdirSync(dir, { recursive: true });

  // Check for conflicts
  const existing = loadAllLocks();
  for (const lock of existing) {
    const overlap = files.filter(f => lock.files.includes(f));
    if (overlap.length > 0) {
      return {
        acquired: false,
        reason: `Files locked by ${lock.taskId} (${lock.roleId}): ${overlap.join(', ')}`,
        conflictsWith: lock.taskId,
      };
    }
  }

  // Create lock
  const lockId = randomUUID();
  const lock = {
    lockId,
    taskId,
    roleId,
    files,
    acquiredAt: new Date().toISOString(),
  };

  writeFileSync(join(dir, `${lockId}.json`), JSON.stringify(lock, null, 2), 'utf8');

  return { acquired: true, lockId };
}

/**
 * Release all locks held by a task.
 *
 * @param {string} taskId — Task ID whose locks should be released
 * @returns {number} Number of locks released
 */
export function releaseLock(taskId) {
  const dir = LOCKS_DIR();
  if (!existsSync(dir)) return 0;

  let released = 0;
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const lock = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    if (lock.taskId === taskId) {
      unlinkSync(join(dir, file));
      released++;
    }
  }

  return released;
}

/**
 * Check if a specific file path is locked.
 *
 * @param {string} filePath — File path to check
 * @returns {object|null} Lock info if locked, null if free
 */
export function checkLock(filePath) {
  const locks = loadAllLocks();
  for (const lock of locks) {
    if (lock.files.includes(filePath)) {
      return { taskId: lock.taskId, roleId: lock.roleId, lockId: lock.lockId, acquiredAt: lock.acquiredAt };
    }
  }
  return null;
}

/**
 * List all active locks.
 *
 * @returns {Array<object>} All active lock records
 */
export function listLocks() {
  return loadAllLocks();
}

function loadAllLocks() {
  const dir = LOCKS_DIR();
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}
