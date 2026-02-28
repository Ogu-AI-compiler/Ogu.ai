/**
 * Semantic Lock — file-level conflict prevention with fingerprinting and staleness detection.
 *
 * Extends basic file-lock with:
 *   - Per-file granular locking (not just task-level)
 *   - File content fingerprinting for change detection
 *   - Conflict prediction before acquisition
 *   - Stale lock cleanup with configurable max age
 *   - Audit trail integration
 *
 * Storage: .ogu/locks/semantic/{lockId}.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';
import { emitAudit } from './audit-emitter.mjs';

const SEMANTIC_LOCKS_DIR = (root) => join(root, '.ogu/locks/semantic');
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// ── File Fingerprinting ──────────────────────────────────────────────

/**
 * Compute a content-based fingerprint for a file.
 * Returns null if the file does not exist.
 *
 * @param {string} filePath - Absolute path to the file
 * @returns {{ hash: string, size: number, exists: boolean } | null}
 */
export function computeFileFingerprint(filePath) {
  if (!existsSync(filePath)) {
    return { hash: 'nonexistent', size: 0, exists: false };
  }
  try {
    const content = readFileSync(filePath, 'utf8');
    const hash = createHash('sha256').update(content).digest('hex');
    return { hash, size: content.length, exists: true };
  } catch {
    return { hash: 'unreadable', size: 0, exists: false };
  }
}

// ── Lock Storage ─────────────────────────────────────────────────────

function ensureDir(root) {
  const dir = SEMANTIC_LOCKS_DIR(root);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function loadLock(dir, filename) {
  try {
    return JSON.parse(readFileSync(join(dir, filename), 'utf8'));
  } catch {
    return null;
  }
}

function loadAllLockFiles(root) {
  const dir = SEMANTIC_LOCKS_DIR(root);
  if (!existsSync(dir)) return [];

  const results = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const lock = loadLock(dir, f);
    if (lock) results.push(lock);
  }
  return results;
}

// ── Conflict Detection ───────────────────────────────────────────────

/**
 * Predict conflicts between a set of files and existing locks.
 * Does NOT acquire any locks.
 *
 * @param {string} root - Project root
 * @param {object} options
 * @param {string[]} options.files - File paths to check
 * @param {object[]} [options.currentLocks] - Pre-loaded locks (optimization)
 * @returns {Array<{ file: string, heldBy: string, lockId: string, agentId: string, acquiredAt: string }>}
 */
export function predictConflicts(root, { files, currentLocks }) {
  root = root || repoRoot();
  const locks = currentLocks || loadAllLockFiles(root);
  const conflicts = [];

  for (const file of files) {
    for (const lock of locks) {
      const lockedFiles = lock.files || [];
      if (lockedFiles.includes(file)) {
        conflicts.push({
          file,
          heldBy: lock.taskId,
          lockId: lock.lockId,
          agentId: lock.agentId || 'unknown',
          featureSlug: lock.featureSlug || null,
          acquiredAt: lock.acquiredAt,
        });
      }
    }
  }

  return conflicts;
}

// ── Acquire ──────────────────────────────────────────────────────────

/**
 * Acquire semantic locks on a set of files.
 *
 * Checks for conflicts with all existing locks. If any file is already
 * locked by a different task, acquisition fails and returns the conflicts.
 *
 * Each locked file gets a content fingerprint at acquisition time, enabling
 * change detection on release.
 *
 * @param {string} root - Project root
 * @param {object} options
 * @param {string[]} options.files - File paths to lock
 * @param {string} options.agentId - Agent requesting the lock
 * @param {string} options.taskId - Task ID for lock ownership
 * @param {string} [options.featureSlug] - Feature context
 * @param {number} [options.timeout] - Lock timeout in ms (default 30s)
 * @returns {{ acquired: boolean, lockId?: string, conflicts?: object[], fingerprints?: object }}
 */
export function acquireSemanticLock(root, { files, agentId, taskId, featureSlug, timeout }) {
  root = root || repoRoot();
  const dir = ensureDir(root);
  const timeoutMs = timeout || DEFAULT_TIMEOUT_MS;

  if (!files || files.length === 0) {
    return { acquired: false, conflicts: [], reason: 'No files specified' };
  }

  if (!agentId || !taskId) {
    return { acquired: false, conflicts: [], reason: 'agentId and taskId are required' };
  }

  // Check for conflicts with existing locks
  const existingLocks = loadAllLockFiles(root);
  const conflicts = predictConflicts(root, { files, currentLocks: existingLocks });

  // Filter out conflicts with our own task (re-entrant)
  const externalConflicts = conflicts.filter(c => c.heldBy !== taskId);

  if (externalConflicts.length > 0) {
    emitAudit('semantic-lock.conflict', {
      taskId,
      agentId,
      files,
      conflicts: externalConflicts,
    }, { severity: 'warn' });

    return {
      acquired: false,
      conflicts: externalConflicts,
      reason: `${externalConflicts.length} file(s) locked by other tasks`,
    };
  }

  // Compute fingerprints for all files at lock time
  const fingerprints = {};
  for (const file of files) {
    fingerprints[file] = computeFileFingerprint(file);
  }

  // Create the lock
  const lockId = randomUUID();
  const lock = {
    $schema: 'SemanticLock/1.0',
    lockId,
    taskId,
    agentId,
    featureSlug: featureSlug || null,
    files,
    fingerprints,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + timeoutMs).toISOString(),
    timeoutMs,
  };

  writeFileSync(join(dir, `${lockId}.json`), JSON.stringify(lock, null, 2), 'utf8');

  emitAudit('semantic-lock.acquired', {
    lockId,
    taskId,
    agentId,
    fileCount: files.length,
    featureSlug: featureSlug || null,
  }, {});

  return { acquired: true, lockId, fingerprints };
}

// ── Release ──────────────────────────────────────────────────────────

/**
 * Release a semantic lock by its lock ID.
 *
 * Computes file fingerprints at release time and detects changes
 * made while the lock was held.
 *
 * @param {string} root - Project root
 * @param {string} lockId - Lock ID to release
 * @returns {{ released: boolean, changes?: object[], reason?: string }}
 */
export function releaseSemanticLock(root, lockId) {
  root = root || repoRoot();
  const dir = SEMANTIC_LOCKS_DIR(root);
  const lockPath = join(dir, `${lockId}.json`);

  if (!existsSync(lockPath)) {
    return { released: false, reason: `Lock ${lockId} not found` };
  }

  let lock;
  try {
    lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return { released: false, reason: `Lock ${lockId} corrupt` };
  }

  // Detect changes by comparing fingerprints
  const changes = [];
  for (const file of lock.files || []) {
    const before = lock.fingerprints?.[file];
    const after = computeFileFingerprint(file);

    if (before && after && before.hash !== after.hash) {
      changes.push({
        file,
        before: before.hash.slice(0, 12),
        after: after.hash.slice(0, 12),
        sizeChange: after.size - before.size,
      });
    }
  }

  // Remove the lock file
  unlinkSync(lockPath);

  emitAudit('semantic-lock.released', {
    lockId,
    taskId: lock.taskId,
    agentId: lock.agentId,
    changedFiles: changes.length,
  }, {});

  return { released: true, lockId, changes };
}

// ── Query ────────────────────────────────────────────────────────────

/**
 * List all active semantic locks.
 *
 * @param {string} root - Project root
 * @returns {Array<object>} All active lock records
 */
export function getActiveLocks(root) {
  root = root || repoRoot();
  return loadAllLockFiles(root);
}

// ── Stale Lock Cleanup ───────────────────────────────────────────────

/**
 * Clean semantic locks older than maxAgeMs.
 *
 * @param {string} root - Project root
 * @param {object} [options]
 * @param {number} [options.maxAgeMs] - Max lock age in ms (default 1 hour)
 * @returns {{ cleaned: number, remaining: number, stale: string[] }}
 */
export function cleanStaleLocks(root, { maxAgeMs } = {}) {
  root = root || repoRoot();
  const dir = SEMANTIC_LOCKS_DIR(root);
  const maxAge = maxAgeMs || DEFAULT_MAX_AGE_MS;
  const now = Date.now();

  if (!existsSync(dir)) {
    return { cleaned: 0, remaining: 0, stale: [] };
  }

  const staleIds = [];
  let remaining = 0;

  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const lock = loadLock(dir, f);
    if (!lock) continue;

    const acquiredAt = new Date(lock.acquiredAt).getTime();
    const age = now - acquiredAt;

    // Check both max age and explicit expiry
    const expired = lock.expiresAt && new Date(lock.expiresAt).getTime() < now;
    const tooOld = age > maxAge;

    if (expired || tooOld) {
      staleIds.push(lock.lockId);
      unlinkSync(join(dir, f));
    } else {
      remaining++;
    }
  }

  if (staleIds.length > 0) {
    emitAudit('semantic-lock.cleanup', {
      cleaned: staleIds.length,
      remaining,
      staleIds,
    }, {});
  }

  return { cleaned: staleIds.length, remaining, stale: staleIds };
}
