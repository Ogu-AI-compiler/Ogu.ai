import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';
import { resolveRuntimePath } from './runtime-paths.mjs';

/**
 * Session Cleanup — find and clean stale agent sessions.
 *
 * Identifies sessions that have been active for too long
 * and marks them as timed_out.
 */

/**
 * Find stale sessions (active but older than maxAgeMs).
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {number} opts.maxAgeMs - Maximum age in milliseconds
 * @returns {Array<{ sessionId, startedAt, ageMs }>}
 */
export function findStaleSessions({ root, maxAgeMs } = {}) {
  root = root || repoRoot();
  const sessDir = resolveRuntimePath(root, 'agents', 'sessions');
  if (!existsSync(sessDir)) return [];

  const now = Date.now();
  const stale = [];

  for (const f of readdirSync(sessDir).filter(f => f.endsWith('.json'))) {
    try {
      const session = JSON.parse(readFileSync(join(sessDir, f), 'utf8'));
      if (session.status !== 'active') continue;

      const age = now - new Date(session.startedAt).getTime();
      if (age > maxAgeMs) {
        stale.push({
          sessionId: session.sessionId,
          startedAt: session.startedAt,
          ageMs: age,
          file: f,
        });
      }
    } catch { /* skip */ }
  }

  return stale;
}

/**
 * Clean up stale sessions by marking them as timed_out.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @param {number} opts.maxAgeMs
 * @returns {{ cleaned: number }}
 */
export function cleanupStaleSessions({ root, maxAgeMs } = {}) {
  root = root || repoRoot();
  const sessDir = resolveRuntimePath(root, 'agents', 'sessions');
  const stale = findStaleSessions({ root, maxAgeMs });

  for (const s of stale) {
    const p = join(sessDir, s.file);
    try {
      const session = JSON.parse(readFileSync(p, 'utf8'));
      session.status = 'timed_out';
      session.timedOutAt = new Date().toISOString();
      writeFileSync(p, JSON.stringify(session, null, 2));
    } catch { /* skip */ }
  }

  return { cleaned: stale.length };
}
