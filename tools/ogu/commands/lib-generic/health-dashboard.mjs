import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../../util.mjs';

/**
 * Health Dashboard — aggregate health status across all subsystems.
 *
 * Checks state, orgspec, budget, audit, and other subsystems.
 * Returns a scored health report.
 */

/**
 * Check system health across all subsystems.
 *
 * @param {object} opts
 * @param {string} opts.root
 * @returns {{ overall: string, score: number, checks: Array<{ name, status, message }> }}
 */
export function checkSystemHealth({ root } = {}) {
  root = root || repoRoot();
  const checks = [];

  // State check
  checks.push(checkFile(root, '.ogu/STATE.json', 'state', 'STATE.json'));

  // OrgSpec check
  checks.push(checkFile(root, '.ogu/OrgSpec.json', 'orgspec', 'OrgSpec.json'));

  // Budget check
  checks.push(checkBudget(root));

  // Audit check
  checks.push(checkFile(root, '.ogu/audit/current.jsonl', 'audit', 'Audit log'));

  // Context check
  checks.push(checkFile(root, '.ogu/CONTEXT.md', 'context', 'CONTEXT.md'));

  // Score calculation
  const passedCount = checks.filter(c => c.status === 'ok').length;
  const score = Math.round((passedCount / checks.length) * 100);

  const overall = score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'unhealthy';

  return { overall, score, checks };
}

function checkFile(root, relPath, name, label) {
  const p = join(root, relPath);
  if (existsSync(p)) {
    return { name, status: 'ok', message: `${label} exists` };
  }
  return { name, status: 'warn', message: `${label} not found` };
}

function checkBudget(root) {
  const p = join(root, '.ogu/budget/budget-state.json');
  if (!existsSync(p)) {
    return { name: 'budget', status: 'warn', message: 'Budget state not found' };
  }

  try {
    const state = JSON.parse(readFileSync(p, 'utf8'));
    const dailyUsage = state.daily?.limit > 0
      ? (state.daily.spent / state.daily.limit)
      : 0;

    if (dailyUsage > 0.9) {
      return { name: 'budget', status: 'error', message: `Budget critical: ${Math.round(dailyUsage * 100)}% daily used` };
    }
    if (dailyUsage > 0.75) {
      return { name: 'budget', status: 'warn', message: `Budget high: ${Math.round(dailyUsage * 100)}% daily used` };
    }
    return { name: 'budget', status: 'ok', message: `Budget ok: ${Math.round(dailyUsage * 100)}% daily used` };
  } catch {
    return { name: 'budget', status: 'warn', message: 'Budget state unreadable' };
  }
}
