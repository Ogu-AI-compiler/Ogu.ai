import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

/**
 * Advisory Locks — cooperative file-level locking with TTL.
 *
 * Non-blocking cooperative locks for protecting shared state files.
 * Locks expire after TTL to prevent deadlocks from crashed processes.
 * Stored in .ogu/locks/advisory/{resource}.lock.json.
 */

function lockDir(root) {
  const dir = join(root, '.ogu/locks/advisory');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function lockPath(root, resource) {
  const key = resource.replace(/[/\\]/g, '__');
  return join(lockDir(root), `${key}.lock.json`);
}

/**
 * Try to acquire an advisory lock.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {string} opts.resource - Resource name to lock
 * @param {string} opts.owner - Owner identifier
 * @param {number} opts.ttlMs - Time-to-live in milliseconds
 * @returns {{ acquired: boolean, lockId?: string, holder?: string, expiresAt?: string }}
 */
export function tryAcquire({ root, resource, owner, ttlMs } = {}) {
  root = root || repoRoot();
  const p = lockPath(root, resource);

  // Check existing lock
  if (existsSync(p)) {
    const existing = JSON.parse(readFileSync(p, 'utf8'));

    // Check if expired
    if (new Date(existing.expiresAt) < new Date()) {
      // Expired — take over
      unlinkSync(p);
    } else if (existing.owner === owner) {
      // Same owner — re-acquire (refresh TTL)
      existing.expiresAt = new Date(Date.now() + ttlMs).toISOString();
      writeFileSync(p, JSON.stringify(existing, null, 2));
      return { acquired: true, lockId: existing.lockId };
    } else {
      // Locked by someone else
      return { acquired: false, holder: existing.owner, expiresAt: existing.expiresAt };
    }
  }

  const lockId = randomUUID();
  const lock = {
    lockId,
    resource,
    owner,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  };

  writeFileSync(p, JSON.stringify(lock, null, 2));
  return { acquired: true, lockId };
}

/**
 * Release an advisory lock.
 */
export function release({ root, resource, owner } = {}) {
  root = root || repoRoot();
  const p = lockPath(root, resource);

  if (existsSync(p)) {
    const existing = JSON.parse(readFileSync(p, 'utf8'));
    if (existing.owner === owner) {
      unlinkSync(p);
      return true;
    }
  }
  return false;
}

/**
 * Check if a resource is locked.
 */
export function isLocked({ root, resource } = {}) {
  root = root || repoRoot();
  const p = lockPath(root, resource);

  if (!existsSync(p)) return false;
  const existing = JSON.parse(readFileSync(p, 'utf8'));
  if (new Date(existing.expiresAt) < new Date()) {
    unlinkSync(p);
    return false;
  }
  return true;
}
