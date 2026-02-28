import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';

/**
 * ogu budget:set [--daily <N>] [--monthly <N>]
 */
export async function budgetSet() {
  const args = process.argv.slice(3);
  const root = repoRoot();

  const dailyIdx = args.indexOf('--daily');
  const monthlyIdx = args.indexOf('--monthly');

  if (dailyIdx < 0 && monthlyIdx < 0) {
    console.error('Usage: ogu budget:set [--daily <N>] [--monthly <N>]');
    return 1;
  }

  const budgetPath = join(root, '.ogu/budget/budget-state.json');
  let budget = {};
  if (existsSync(budgetPath)) {
    budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
  }

  if (dailyIdx >= 0) {
    const val = parseFloat(args[dailyIdx + 1]);
    if (!budget.daily) budget.daily = { limit: 0, costUsed: 0, tokenCount: 0 };
    budget.daily.limit = val;
  }

  if (monthlyIdx >= 0) {
    const val = parseFloat(args[monthlyIdx + 1]);
    if (!budget.monthly) budget.monthly = { limit: 0, costUsed: 0 };
    budget.monthly.limit = val;
  }

  writeFileSync(budgetPath, JSON.stringify(budget, null, 2));
  console.log(`Budget updated: daily=$${budget.daily?.limit || 0}, monthly=$${budget.monthly?.limit || 0}`);

  return 0;
}
