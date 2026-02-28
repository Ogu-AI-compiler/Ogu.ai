/**
 * Health Probe — deep health check with dependency resolution.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PROBE_CHECKS = ['state', 'audit', 'budget', 'context', 'git'];

/**
 * Run health probe on an Ogu project.
 *
 * @param {{ root: string }} opts
 * @returns {{ healthy: boolean, score: number, checks: Array }}
 */
export function runHealthProbe({ root }) {
  const checks = [];

  // State check
  const stateExists = existsSync(join(root, '.ogu/STATE.json'));
  checks.push({
    name: 'state',
    status: stateExists ? 'pass' : 'fail',
    detail: stateExists ? 'STATE.json present' : 'STATE.json missing',
  });

  // Audit check
  const auditExists = existsSync(join(root, '.ogu/audit/current.jsonl'));
  checks.push({
    name: 'audit',
    status: auditExists ? 'pass' : 'warn',
    detail: auditExists ? 'Audit log present' : 'No audit log',
  });

  // Budget check
  const budgetExists = existsSync(join(root, '.ogu/budget/budget-state.json'));
  checks.push({
    name: 'budget',
    status: budgetExists ? 'pass' : 'warn',
    detail: budgetExists ? 'Budget state present' : 'No budget state',
  });

  // Context check
  const ctxExists = existsSync(join(root, '.ogu/CONTEXT.md'));
  checks.push({
    name: 'context',
    status: ctxExists ? 'pass' : 'warn',
    detail: ctxExists ? 'CONTEXT.md present' : 'No context file',
  });

  // Git check
  const gitExists = existsSync(join(root, '.git'));
  checks.push({
    name: 'git',
    status: gitExists ? 'pass' : 'fail',
    detail: gitExists ? 'Git repository detected' : 'Not a git repository',
  });

  // Compute score
  const weights = { pass: 1, warn: 0.5, fail: 0 };
  const total = checks.reduce((sum, c) => sum + (weights[c.status] || 0), 0);
  const score = Math.round((total / checks.length) * 100);
  const healthy = checks.every(c => c.status !== 'fail');

  return { healthy, score, checks };
}
