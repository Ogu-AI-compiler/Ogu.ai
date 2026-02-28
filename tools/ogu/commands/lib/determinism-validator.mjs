/**
 * Determinism Validator — detect and persist non-deterministic behavior.
 *
 * Functions:
 *   classifyOperation(op)           — Classify single operation as deterministic/non-deterministic
 *   validateDeterminism({ ops })    — Validate operation log for determinism
 *   compareOutputs(expected, actual) — Compare two task outputs for determinism
 *   recordViolation(root, entry)    — Append violation to ledger (.ogu/determinism/ledger.jsonl)
 *   loadLedger(root, opts)          — Load ledger entries (optionally filtered)
 *   analyzeLedger(root)             — Compute stats from ledger
 */

import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { computeDivergence, classifyDivergence, isWithinTolerance } from './determinism-tolerance.mjs';

const LEDGER_DIR = '.ogu/determinism';
const LEDGER_FILE = 'ledger.jsonl';

const NON_DETERMINISTIC_TYPES = new Set([
  'random', 'timestamp', 'date.now', 'uuid',
  'network', 'process.pid', 'math.random',
]);

/**
 * Classify a single operation.
 *
 * @param {object} op — { type, ... }
 * @returns {'deterministic' | 'non-deterministic'}
 */
export function classifyOperation(op) {
  if (NON_DETERMINISTIC_TYPES.has(op.type)) return 'non-deterministic';
  return 'deterministic';
}

/**
 * Validate determinism of an operation log.
 *
 * @param {object} opts — { operations: Array<{ type, ... }> }
 * @returns {{ isDeterministic: boolean, violations: object[], totalOperations: number }}
 */
export function validateDeterminism({ operations }) {
  const violations = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const classification = classifyOperation(op);
    if (classification === 'non-deterministic') {
      violations.push({
        index: i,
        type: op.type,
        classification,
        reason: `Operation type "${op.type}" is inherently non-deterministic`,
      });
    }
  }

  return {
    isDeterministic: violations.length === 0,
    violations,
    totalOperations: operations.length,
  };
}

/**
 * Compare two task outputs for determinism.
 *
 * Compares file-by-file: content hash, divergence score, classification.
 *
 * @param {object} opts
 * @param {Array<{path: string, content: string}>} opts.expected — expected output files
 * @param {Array<{path: string, content: string}>} opts.actual — actual output files
 * @param {string} [opts.tolerance='normal'] — tolerance level
 * @returns {{ deterministic: boolean, fileResults: object[], overallScore: number }}
 */
export function compareOutputs({ expected, actual, tolerance = 'normal' }) {
  const expectedMap = new Map(expected.map(f => [f.path, f.content]));
  const actualMap = new Map(actual.map(f => [f.path, f.content]));

  const allPaths = new Set([...expectedMap.keys(), ...actualMap.keys()]);
  const fileResults = [];
  let totalScore = 0;
  let fileCount = 0;

  for (const path of allPaths) {
    const exp = expectedMap.get(path);
    const act = actualMap.get(path);

    if (exp === undefined) {
      fileResults.push({ path, status: 'extra', score: 0, details: 'File exists in actual but not expected' });
      fileCount++;
      continue;
    }
    if (act === undefined) {
      fileResults.push({ path, status: 'missing', score: 0, details: 'File exists in expected but not actual' });
      fileCount++;
      continue;
    }

    // Hash comparison (fast path)
    const expHash = hashStr(exp);
    const actHash = hashStr(act);
    if (expHash === actHash) {
      fileResults.push({ path, status: 'identical', score: 1.0, hash: expHash });
      totalScore += 1.0;
      fileCount++;
      continue;
    }

    // Divergence analysis
    const divergence = computeDivergence({ expected: exp, actual: act });
    const classification = classifyDivergence({ expected: exp, actual: act });
    const withinTolerance = isWithinTolerance(divergence.score, tolerance);

    fileResults.push({
      path,
      status: withinTolerance ? 'acceptable' : 'divergent',
      score: divergence.score,
      divergenceType: classification.type,
      details: classification.details,
      expectedHash: expHash,
      actualHash: actHash,
    });

    totalScore += divergence.score;
    fileCount++;
  }

  const overallScore = fileCount > 0 ? Math.round((totalScore / fileCount) * 1000) / 1000 : 1.0;
  const deterministic = fileResults.every(f => f.status === 'identical' || f.status === 'acceptable');

  return { deterministic, fileResults, overallScore };
}

/**
 * Record a determinism violation to the ledger.
 *
 * @param {string} root — repo root
 * @param {object} entry
 * @param {string} entry.taskId
 * @param {string} entry.featureSlug
 * @param {string} [entry.agentId]
 * @param {string} entry.type — violation type (cosmetic|structural|semantic|extra|missing)
 * @param {string} [entry.file] — affected file path
 * @param {number} [entry.score] — similarity score
 * @param {string} [entry.details]
 * @param {string} [entry.cause] — root cause if known
 */
export function recordViolation(root, entry) {
  const dir = join(root, LEDGER_DIR);
  mkdirSync(dir, { recursive: true });

  const record = {
    ...entry,
    recordedAt: new Date().toISOString(),
  };

  appendFileSync(join(dir, LEDGER_FILE), JSON.stringify(record) + '\n', 'utf8');
  return record;
}

/**
 * Load ledger entries, optionally filtered.
 *
 * @param {string} root
 * @param {object} [opts]
 * @param {string} [opts.featureSlug] — filter by feature
 * @param {string} [opts.taskId] — filter by task
 * @param {string} [opts.type] — filter by violation type
 * @param {number} [opts.limit] — max entries to return
 * @returns {object[]}
 */
export function loadLedger(root, opts = {}) {
  const ledgerPath = join(root, LEDGER_DIR, LEDGER_FILE);
  if (!existsSync(ledgerPath)) return [];

  const lines = readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean);
  let entries = lines.map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  if (opts.featureSlug) entries = entries.filter(e => e.featureSlug === opts.featureSlug);
  if (opts.taskId) entries = entries.filter(e => e.taskId === opts.taskId);
  if (opts.type) entries = entries.filter(e => e.type === opts.type);
  if (opts.limit) entries = entries.slice(-opts.limit);

  return entries;
}

/**
 * Analyze the ledger for patterns.
 *
 * @param {string} root
 * @returns {{ totalViolations: number, byType: object, byFeature: object, topFiles: object[], recentRate: number }}
 */
export function analyzeLedger(root) {
  const entries = loadLedger(root);

  const byType = {};
  const byFeature = {};
  const fileCount = {};

  for (const entry of entries) {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    if (entry.featureSlug) {
      byFeature[entry.featureSlug] = (byFeature[entry.featureSlug] || 0) + 1;
    }
    if (entry.file) {
      fileCount[entry.file] = (fileCount[entry.file] || 0) + 1;
    }
  }

  // Top offending files
  const topFiles = Object.entries(fileCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file, count]) => ({ file, count }));

  // Recent rate (last 24h)
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const recentCount = entries.filter(e => e.recordedAt >= oneDayAgo).length;

  return {
    totalViolations: entries.length,
    byType,
    byFeature,
    topFiles,
    recentRate: recentCount,
  };
}

// ── Helpers ──

function hashStr(str) {
  return createHash('sha256').update(str).digest('hex');
}
