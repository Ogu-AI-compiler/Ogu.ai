/**
 * handoff-validator.mjs
 * Validates artifact handoffs between domain compilers.
 *
 * When compiler B (e.g. engineer) is about to start, it validates that
 * compiler A (e.g. architect) produced sealed artifacts that meet its requirements.
 *
 * Storage:
 *   .ogu/compilers/compatibility.json — tracks handoff history between compiler pairs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getCompiler } from './compiler-registry.mjs';
import { emitAudit } from './audit-emitter.mjs';

function compatPath(root) {
  return join(root, '.ogu', 'compilers', 'compatibility.json');
}

function readCompat(root) {
  const p = compatPath(root);
  if (!existsSync(p)) return { pairs: [] };
  try { return JSON.parse(readFileSync(p, 'utf-8')); }
  catch { return { pairs: [] }; }
}

function writeCompat(root, data) {
  mkdirSync(join(root, '.ogu', 'compilers'), { recursive: true });
  writeFileSync(compatPath(root), JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * validateHandoff(root, options) → HandoffResult
 *
 * Checks that artifacts produced by `fromRole` satisfy the input_requirements
 * of `toRole`'s compiler.
 *
 * @param {string} root
 * @param {object} options
 *   @param {string}   options.fromRole     — producing compiler role slug
 *   @param {string}   options.toRole       — consuming compiler role slug
 *   @param {string[]} options.artifacts    — list of artifact file paths produced
 *   @param {object}   options.attestations — { [artifactPath]: attestation } (optional)
 *   @param {string}   options.featureSlug
 *   @param {string}   options.taskId
 *
 * @returns {{ valid: boolean, checks: Check[], missing: string[] }}
 */
export function validateHandoff(root, { fromRole, toRole, artifacts, attestations = {}, featureSlug, taskId }) {
  const toCompiler = getCompiler(root, toRole);

  // No compiler for toRole — handoff is open (not validated)
  if (!toCompiler) {
    return { valid: true, checks: [], missing: [], skipped: true };
  }

  const requirements = toCompiler.handoff?.input_requirements ?? [];
  const checks = [];
  const missing = [];

  for (const req of requirements) {
    const check = _evaluateRequirement(req, artifacts, attestations, root);
    checks.push(check);
    if (!check.satisfied) missing.push(req.description ?? req);
  }

  const valid = missing.length === 0;

  // Record compatibility
  _recordCompatibility(root, fromRole, toRole, valid);

  emitAudit('compiler.handoff', {
    fromRole,
    toRole,
    featureSlug,
    taskId,
    valid,
    missing,
  }, { source: 'kadima', severity: valid ? 'info' : 'warn' });

  return { valid, checks, missing, skipped: false };
}

/**
 * getCompatibilityScore(root, fromRole, toRole) → { total, passed, score }
 *
 * Returns historical handoff compatibility between two compiler roles.
 */
export function getCompatibilityScore(root, fromRole, toRole) {
  const compat = readCompat(root);
  const key = `${fromRole}→${toRole}`;
  const pair = compat.pairs.find(p => p.key === key);
  if (!pair) return { total: 0, passed: 0, score: null };
  const score = pair.total > 0
    ? Math.round((pair.passed / pair.total) * 100) / 100
    : 0;
  return { total: pair.total, passed: pair.passed, score };
}

/**
 * getHandoffReport(root) → string
 * Human-readable compatibility matrix.
 */
export function getHandoffReport(root) {
  const compat = readCompat(root);
  if (compat.pairs.length === 0) return '  No handoff history yet.';

  const lines = ['  Compiler Handoff Compatibility:', ''];
  for (const pair of compat.pairs.sort((a, b) => b.total - a.total)) {
    const score = pair.total > 0 ? Math.round((pair.passed / pair.total) * 100) : 0;
    lines.push(`  ${pair.key.padEnd(40)} ${score}% (${pair.passed}/${pair.total})`);
  }
  return lines.join('\n');
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _evaluateRequirement(req, artifacts, attestations, root) {
  // req can be a string (legacy) or { type, description, pattern, sealed }
  if (typeof req === 'string') {
    return { requirement: req, satisfied: true, reason: 'string requirements auto-pass (upgrade to object)' };
  }

  const { type, description, pattern, sealed } = req;

  // Check file exists
  if (type === 'file_exists' || type === 'artifact_exists') {
    const found = artifacts.some(a => a.includes(pattern) || a.endsWith(pattern));
    if (!found) return { requirement: description, satisfied: false, reason: `No artifact matching "${pattern}"` };

    // Check sealed (attestation present)
    if (sealed) {
      const attestedFile = artifacts.find(a => a.includes(pattern) || a.endsWith(pattern));
      if (attestedFile && !attestations[attestedFile]) {
        return { requirement: description, satisfied: false, reason: `Artifact "${attestedFile}" is not sealed` };
      }
    }

    return { requirement: description, satisfied: true, reason: `Found "${pattern}"` };
  }

  // Default: pass
  return { requirement: description ?? req, satisfied: true, reason: 'auto-pass' };
}

function _recordCompatibility(root, fromRole, toRole, passed) {
  const compat = readCompat(root);
  const key = `${fromRole}→${toRole}`;
  const pair = compat.pairs.find(p => p.key === key);
  if (pair) {
    pair.total += 1;
    if (passed) pair.passed += 1;
    pair.last_at = new Date().toISOString();
  } else {
    compat.pairs.push({
      key,
      fromRole,
      toRole,
      total: 1,
      passed: passed ? 1 : 0,
      last_at: new Date().toISOString(),
    });
  }
  writeCompat(root, compat);
}
