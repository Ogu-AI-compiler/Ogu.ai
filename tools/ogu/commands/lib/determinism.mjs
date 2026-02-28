import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { repoRoot } from '../../util.mjs';

/**
 * Determinism Tracking Helpers — log, capture, verify, and report
 * non-deterministic behavior across task executions.
 *
 * Exports:
 *   logNonDeterminism(root, entry)           — Log a non-deterministic event
 *   captureInputSnapshot(root, opts)         — Capture inputs before a task
 *   verifyDeterminism(root, snap1, snap2)    — Compare two input snapshots
 *   getDeterminismReport(root, opts)         — Summary for a feature
 */

const LOG_FILE = 'determinism-log.jsonl';
const SNAPSHOTS_DIR = 'determinism/snapshots';

/**
 * Log a non-deterministic event to .ogu/determinism-log.jsonl.
 *
 * @param {string} root - Repository root path
 * @param {object} entry
 * @param {string} entry.source - Source of non-determinism (e.g., 'llm-response', 'timestamp', 'random')
 * @param {string} entry.description - Human-readable description
 * @param {string} entry.impact - Impact level: 'low', 'medium', 'high'
 * @param {string} [entry.taskId] - Associated task ID
 * @returns {object} The logged event
 */
export function logNonDeterminism(root, { source, description, impact, taskId }) {
  root = root || repoRoot();
  const logPath = join(root, '.ogu', LOG_FILE);

  const dir = join(root, '.ogu');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const event = {
    timestamp: new Date().toISOString(),
    source,
    description,
    impact: impact || 'low',
    taskId: taskId || null,
  };

  appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf8');
  return event;
}

/**
 * Capture the inputs before a task for later comparison.
 * Writes a snapshot file to .ogu/determinism/snapshots/.
 *
 * @param {string} root - Repository root path
 * @param {object} opts
 * @param {string} opts.featureSlug - Feature slug
 * @param {string} opts.taskId - Task identifier
 * @param {object} opts.inputs - The input data to snapshot
 * @returns {object} Snapshot metadata { id, hash, path, capturedAt }
 */
export function captureInputSnapshot(root, { featureSlug, taskId, inputs }) {
  root = root || repoRoot();
  const snapDir = join(root, '.ogu', SNAPSHOTS_DIR);
  if (!existsSync(snapDir)) mkdirSync(snapDir, { recursive: true });

  const canonical = JSON.stringify(inputs, Object.keys(inputs).sort(), 2);
  const hash = createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  const id = `${featureSlug}-${taskId}-${Date.now()}`;
  const snapPath = join(snapDir, `${id}.json`);

  const snapshot = {
    id,
    featureSlug,
    taskId,
    hash,
    capturedAt: new Date().toISOString(),
    inputs,
  };

  appendFileSync(snapPath, JSON.stringify(snapshot, null, 2), 'utf8');

  return { id, hash, path: snapPath, capturedAt: snapshot.capturedAt };
}

/**
 * Compare two input snapshots and return determinism result.
 *
 * @param {string} root - Repository root path
 * @param {object} snap1 - First snapshot (or path string)
 * @param {object} snap2 - Second snapshot (or path string)
 * @returns {{ deterministic: boolean, diffs: object[] }}
 */
export function verifyDeterminism(root, snap1, snap2) {
  root = root || repoRoot();

  const s1 = typeof snap1 === 'string' ? loadSnapshot(snap1) : snap1;
  const s2 = typeof snap2 === 'string' ? loadSnapshot(snap2) : snap2;

  if (!s1 || !s2) {
    return { deterministic: false, diffs: [{ key: '_error', reason: 'Missing snapshot(s)' }] };
  }

  // Fast path: hash comparison
  if (s1.hash && s2.hash && s1.hash === s2.hash) {
    return { deterministic: true, diffs: [] };
  }

  // Deep comparison of inputs
  const diffs = [];
  const inputs1 = s1.inputs || {};
  const inputs2 = s2.inputs || {};
  const allKeys = new Set([...Object.keys(inputs1), ...Object.keys(inputs2)]);

  for (const key of allKeys) {
    const v1 = JSON.stringify(inputs1[key]);
    const v2 = JSON.stringify(inputs2[key]);

    if (v1 !== v2) {
      diffs.push({
        key,
        reason: !(key in inputs1) ? 'missing in first'
          : !(key in inputs2) ? 'missing in second'
          : 'value differs',
        before: inputs1[key],
        after: inputs2[key],
      });
    }
  }

  return {
    deterministic: diffs.length === 0,
    diffs,
  };
}

/**
 * Summary of non-deterministic events for a feature.
 *
 * @param {string} root - Repository root path
 * @param {object} opts
 * @param {string} opts.featureSlug - Feature to filter by (optional)
 * @returns {{ total: number, bySource: object, byImpact: object, events: object[] }}
 */
export function getDeterminismReport(root, { featureSlug } = {}) {
  root = root || repoRoot();
  const logPath = join(root, '.ogu', LOG_FILE);

  if (!existsSync(logPath)) {
    return { total: 0, bySource: {}, byImpact: {}, events: [] };
  }

  let events = readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);

  // Filter by feature slug via taskId prefix convention
  if (featureSlug) {
    events = events.filter(e => e.taskId && e.taskId.startsWith(featureSlug));
  }

  const bySource = {};
  const byImpact = {};

  for (const e of events) {
    bySource[e.source] = (bySource[e.source] || 0) + 1;
    byImpact[e.impact] = (byImpact[e.impact] || 0) + 1;
  }

  return {
    total: events.length,
    bySource,
    byImpact,
    events,
  };
}

// ── Internal ──

function loadSnapshot(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}
