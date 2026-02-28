import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../util.mjs';

/**
 * ogu budget:status [--json] — Show current budget status.
 * ogu budget:check --cost <amount> [--json] — Check if a cost is within limits.
 */

function loadOrgSpec(root) {
  const path = join(root, '.ogu/OrgSpec.json');
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadBudgetState(root) {
  const path = join(root, '.ogu/budget/budget-state.json');
  if (!existsSync(path)) {
    return { version: 1, daily: {}, monthly: {}, byFeature: {}, byModel: {}, updatedAt: new Date().toISOString() };
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export async function budgetStatus() {
  const args = process.argv.slice(3);
  const jsonOutput = args.includes('--json');

  const root = repoRoot();
  const orgSpec = loadOrgSpec(root);
  const state = loadBudgetState(root);

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const dailyLimit = orgSpec?.budget?.dailyLimit || 50;
  const monthlyLimit = orgSpec?.budget?.monthlyLimit || 500;
  const alertThreshold = orgSpec?.budget?.alertThreshold || 0.8;

  const dailySpent = state.daily?.[today]?.spent || 0;
  const monthlySpent = state.monthly?.[month]?.spent || 0;
  const dailyRemaining = Math.max(0, dailyLimit - dailySpent);
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlySpent);

  const result = {
    dailySpent: Math.round(dailySpent * 100) / 100,
    dailyLimit,
    dailyRemaining: Math.round(dailyRemaining * 100) / 100,
    monthlySpent: Math.round(monthlySpent * 100) / 100,
    monthlyLimit,
    monthlyRemaining: Math.round(monthlyRemaining * 100) / 100,
    alertThreshold,
    dailyWarning: dailySpent >= dailyLimit * alertThreshold,
    monthlyWarning: monthlySpent >= monthlyLimit * alertThreshold,
    byModel: state.byModel || {},
    byFeature: state.byFeature || {},
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Budget Status (${today})`);
    console.log(`  Daily:   $${result.dailySpent} / $${dailyLimit} ($${result.dailyRemaining} remaining)`);
    console.log(`  Monthly: $${result.monthlySpent} / $${monthlyLimit} ($${result.monthlyRemaining} remaining)`);
    if (result.dailyWarning) console.log('  ⚠ Daily budget above alert threshold');
    if (result.monthlyWarning) console.log('  ⚠ Monthly budget above alert threshold');
  }

  return 0;
}

export async function budgetCheck() {
  const args = process.argv.slice(3);
  let cost = null, jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cost' && args[i + 1]) cost = parseFloat(args[++i]);
    else if (args[i] === '--json') jsonOutput = true;
  }

  if (cost === null || isNaN(cost)) {
    console.error('Usage: ogu budget:check --cost <amount> [--json]');
    return 1;
  }

  const root = repoRoot();
  const orgSpec = loadOrgSpec(root);
  const state = loadBudgetState(root);

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const dailyLimit = orgSpec?.budget?.dailyLimit || 50;
  const monthlyLimit = orgSpec?.budget?.monthlyLimit || 500;
  const alertThreshold = orgSpec?.budget?.alertThreshold || 0.8;

  const dailySpent = state.daily?.[today]?.spent || 0;
  const monthlySpent = state.monthly?.[month]?.spent || 0;

  const dailyAfter = dailySpent + cost;
  const monthlyAfter = monthlySpent + cost;

  let allowed = true;
  let reason = 'Within budget';
  let warning = false;

  if (dailyAfter > dailyLimit) {
    allowed = false;
    reason = `Exceeds daily limit: $${dailySpent} + $${cost} = $${dailyAfter} > $${dailyLimit}`;
  } else if (monthlyAfter > monthlyLimit) {
    allowed = false;
    reason = `Exceeds monthly limit: $${monthlySpent} + $${cost} = $${monthlyAfter} > $${monthlyLimit}`;
  }

  if (allowed && (dailyAfter >= dailyLimit * alertThreshold || dailySpent >= dailyLimit * alertThreshold)) {
    warning = true;
  }

  const result = { allowed, reason, warning, dailySpent, dailyLimit, cost };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (allowed) {
      console.log(`✓ Budget OK: $${cost} within limits`);
      if (warning) console.log(`  ⚠ Approaching daily limit (${Math.round(dailyAfter / dailyLimit * 100)}%)`);
    } else {
      console.log(`✗ Budget exceeded: ${reason}`);
    }
  }

  return allowed ? 0 : 1;
}
