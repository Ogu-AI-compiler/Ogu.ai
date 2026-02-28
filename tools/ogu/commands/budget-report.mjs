import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';
import { deductBudget, loadBudget, generateReport } from './lib/budget-tracker.mjs';
import { emitAudit } from './lib/audit-emitter.mjs';

/**
 * ogu budget:record --feature <slug> --cost <amount> --tokens <N> --model <id> [--role <roleId>]
 * ogu budget:report [--json] [--feature <slug>]
 */

function parseArgs() {
  const args = process.argv.slice(3);
  const result = { json: false, feature: null, cost: null, tokens: null, model: null, role: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') result.json = true;
    else if (args[i] === '--feature' && args[i + 1]) result.feature = args[++i];
    else if (args[i] === '--cost' && args[i + 1]) result.cost = parseFloat(args[++i]);
    else if (args[i] === '--tokens' && args[i + 1]) result.tokens = parseInt(args[++i], 10);
    else if (args[i] === '--model' && args[i + 1]) result.model = args[++i];
    else if (args[i] === '--role' && args[i + 1]) result.role = args[++i];
  }

  return result;
}

export async function budgetRecord() {
  const args = parseArgs();

  if (!args.feature || args.cost === null || isNaN(args.cost)) {
    console.error('Usage: ogu budget:record --feature <slug> --cost <amount> --tokens <N> --model <id> [--role <roleId>]');
    return 1;
  }

  const tokens = args.tokens || 0;
  const inputTokens = Math.round(tokens * 0.7);
  const outputTokens = tokens - inputTokens;

  deductBudget({
    featureSlug: args.feature,
    taskId: `manual-${Date.now()}`,
    agentRoleId: args.role || 'manual',
    model: args.model || 'unknown',
    provider: 'manual',
    inputTokens,
    outputTokens,
    cost: args.cost,
  });

  emitAudit('budget.recorded', {
    feature: args.feature,
    cost: args.cost,
    tokens,
    model: args.model,
    role: args.role,
  });

  console.log(`Recorded: $${args.cost} for "${args.feature}" (${tokens} tokens, ${args.model || 'unknown'})`);
  return 0;
}

export async function budgetReport() {
  const args = parseArgs();

  const report = generateReport({ featureSlug: args.feature || undefined });

  // Add feature detail if specified
  if (args.feature) {
    report.featureDetail = report.byFeature[args.feature] || { cost: 0, tokens: 0, calls: 0 };
  }

  const { byFeature, byModel, byRole } = report;

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }

  // Human-readable output
  console.log(`\n  Budget Report`);
  console.log(`  ─────────────`);
  console.log(`  Daily:   $${report.daily.spent.toFixed(2)} / $${report.daily.limit} (${report.daily.tokens} tokens)`);
  console.log(`  Monthly: $${report.monthly.spent.toFixed(2)} / $${report.monthly.limit} (${report.monthly.tokens} tokens)`);
  console.log(`  Transactions: ${report.totalTransactions}`);

  if (args.feature && report.featureDetail) {
    console.log(`\n  Feature: ${args.feature}`);
    console.log(`    Cost: $${report.featureDetail.cost.toFixed(2)} | Tokens: ${report.featureDetail.tokens} | Calls: ${report.featureDetail.calls}`);
  }

  if (Object.keys(byFeature).length > 0) {
    console.log(`\n  By Feature:`);
    for (const [f, data] of Object.entries(byFeature)) {
      console.log(`    ${f.padEnd(24)} $${data.cost.toFixed(2).padStart(8)} | ${String(data.tokens).padStart(8)} tokens | ${data.calls} calls`);
    }
  }

  if (Object.keys(byModel).length > 0) {
    console.log(`\n  By Model:`);
    for (const [m, data] of Object.entries(byModel)) {
      console.log(`    ${m.padEnd(30)} $${data.cost.toFixed(2).padStart(8)} | ${data.calls} calls`);
    }
  }

  if (Object.keys(byRole).length > 0) {
    console.log(`\n  By Role:`);
    for (const [r, data] of Object.entries(byRole)) {
      console.log(`    ${r.padEnd(16)} $${data.cost.toFixed(2).padStart(8)} | ${data.calls} calls`);
    }
  }

  console.log('');
  return 0;
}
