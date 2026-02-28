#!/usr/bin/env node

/**
 * Slice 6 — Model Router + Budget Limits + Task Retry + Escalation
 *
 * Proves:
 *   1. Model Router selects the right model based on tier, capability, and budget
 *   2. Budget enforces daily limits — rejects tasks when exceeded
 *   3. Failed tasks are retried (up to maxRetries)
 *   4. Escalation: task fails at "standard" tier → retried at "advanced" tier
 *   5. Budget tracks per-model and per-feature spending
 *
 * Depends on: Slices 1-5
 *
 * Run: node tests/e2e/slice-6.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// ── Test harness ──

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected "${expected}", got "${actual}"`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ── Helpers ──

const CLI = join(import.meta.dirname, '../../tools/ogu/cli.mjs');
const ROOT = join(import.meta.dirname, '../../');

function ogu(command, args = []) {
  const allArgs = [CLI, command, ...args];
  try {
    const output = execFileSync('node', allArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, OGU_ROOT: ROOT, NODE_NO_WARNINGS: '1' },
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout?.toString() ?? '',
      stderr: err.stderr?.toString() ?? '',
    };
  }
}

function readJSON(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

function writeJSON(relPath, data) {
  const fullPath = join(ROOT, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

function readJSONL(relPath) {
  const fp = join(ROOT, relPath);
  if (!existsSync(fp)) return [];
  return readFileSync(fp, 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

// ── Setup ──

function setup() {
  ogu('org:init', ['--minimal']);

  // Write OrgSpec with multiple providers and models at different tiers
  const orgSpec = readJSON('.ogu/OrgSpec.json');
  orgSpec.providers = [
    {
      id: 'anthropic',
      name: 'Anthropic',
      models: [
        { id: 'claude-haiku-4-5-20251001', tier: 'fast', capabilities: ['code_generation', 'review'], costPer1kInput: 0.001, costPer1kOutput: 0.005 },
        { id: 'claude-sonnet-4-20250514', tier: 'standard', capabilities: ['code_generation', 'review', 'architecture'], costPer1kInput: 0.003, costPer1kOutput: 0.015 },
        { id: 'claude-opus-4-6', tier: 'advanced', capabilities: ['code_generation', 'review', 'architecture', 'security_audit', 'complex_reasoning'], costPer1kInput: 0.015, costPer1kOutput: 0.075 },
      ],
    },
  ];
  orgSpec.budget = {
    dailyLimit: 50,
    monthlyLimit: 500,
    alertThreshold: 0.8,
    currency: 'USD',
  };
  orgSpec.escalation = {
    enabled: true,
    maxRetries: 2,
    tierOrder: ['fast', 'standard', 'advanced'],
  };
  writeJSON('.ogu/OrgSpec.json', orgSpec);
}

// ── Tests ──

console.log('\n\x1b[1mSlice 6 — Model Router + Budget + Retry + Escalation\x1b[0m\n');

setup();

// ── Part 1: Model Router — Selection Logic ──

console.log('\x1b[36m  Part 1: Model Router Selection\x1b[0m');

await test('route:select picks cheapest model that has required capability', async () => {
  const result = ogu('route:select', ['--capability', 'code_generation', '--json']);
  assertEqual(result.exitCode, 0, 'route:select should exit 0');
  const route = JSON.parse(result.stdout);
  assertEqual(route.model, 'claude-haiku-4-5-20251001', 'Should pick cheapest model (haiku) for basic code_generation');
  assertEqual(route.tier, 'fast', 'Should be fast tier');
});

await test('route:select picks higher tier for advanced capabilities', async () => {
  const result = ogu('route:select', ['--capability', 'security_audit', '--json']);
  assertEqual(result.exitCode, 0, 'route:select should exit 0');
  const route = JSON.parse(result.stdout);
  assertEqual(route.model, 'claude-opus-4-6', 'Only opus has security_audit capability');
  assertEqual(route.tier, 'advanced', 'Should be advanced tier');
});

await test('route:select respects --tier flag override', async () => {
  const result = ogu('route:select', ['--capability', 'code_generation', '--tier', 'standard', '--json']);
  assertEqual(result.exitCode, 0, 'route:select should exit 0');
  const route = JSON.parse(result.stdout);
  assertEqual(route.model, 'claude-sonnet-4-20250514', 'Should pick sonnet at standard tier');
});

await test('route:select respects --min-tier flag', async () => {
  const result = ogu('route:select', ['--capability', 'code_generation', '--min-tier', 'standard', '--json']);
  assertEqual(result.exitCode, 0, 'route:select should exit 0');
  const route = JSON.parse(result.stdout);
  // Should pick cheapest at standard or above → sonnet
  assertEqual(route.model, 'claude-sonnet-4-20250514', 'Should pick sonnet (cheapest at standard+)');
});

// ── Part 2: Budget Enforcement ──

console.log('\n\x1b[36m  Part 2: Budget Enforcement\x1b[0m');

await test('budget:status shows current spending', async () => {
  const result = ogu('budget:status', ['--json']);
  assertEqual(result.exitCode, 0, 'budget:status should exit 0');
  const budget = JSON.parse(result.stdout);
  assert(typeof budget.dailySpent === 'number', 'Should have dailySpent');
  assert(typeof budget.dailyLimit === 'number', 'Should have dailyLimit');
  assert(typeof budget.dailyRemaining === 'number', 'Should have dailyRemaining');
});

await test('budget:check allows task within daily limit', async () => {
  const result = ogu('budget:check', ['--cost', '5.00', '--json']);
  assertEqual(result.exitCode, 0, 'budget:check should exit 0');
  const check = JSON.parse(result.stdout);
  assertEqual(check.allowed, true, 'Should allow $5 task within $50 daily limit');
});

await test('budget:check rejects task exceeding daily limit', async () => {
  // Simulate high spending by writing budget state
  const today = new Date().toISOString().slice(0, 10);
  writeJSON('.ogu/budget/budget-state.json', {
    version: 1,
    daily: { [today]: { spent: 48, transactions: [] } },
    monthly: { [today.slice(0, 7)]: { spent: 48, transactions: [] } },
    byFeature: {},
    byModel: {},
    updatedAt: new Date().toISOString(),
  });

  const result = ogu('budget:check', ['--cost', '5.00', '--json']);
  const check = JSON.parse(result.stdout);
  assertEqual(check.allowed, false, 'Should reject $5 task when $48/$50 daily spent');
  assert(check.reason.includes('daily') || check.reason.includes('limit'), `Reason should mention daily limit: ${check.reason}`);
});

await test('budget:check warns at alert threshold', async () => {
  const today = new Date().toISOString().slice(0, 10);
  writeJSON('.ogu/budget/budget-state.json', {
    version: 1,
    daily: { [today]: { spent: 41, transactions: [] } },
    monthly: { [today.slice(0, 7)]: { spent: 41, transactions: [] } },
    byFeature: {},
    byModel: {},
    updatedAt: new Date().toISOString(),
  });

  const result = ogu('budget:check', ['--cost', '2.00', '--json']);
  const check = JSON.parse(result.stdout);
  assertEqual(check.allowed, true, 'Should still allow (41+2 < 50)');
  assertEqual(check.warning, true, 'Should warn (41/50 > 80% threshold)');
});

// ── Part 3: Route with Budget Awareness ──

console.log('\n\x1b[36m  Part 3: Budget-Aware Routing\x1b[0m');

await test('route:select downgrades tier when budget is low', async () => {
  const today = new Date().toISOString().slice(0, 10);
  writeJSON('.ogu/budget/budget-state.json', {
    version: 1,
    daily: { [today]: { spent: 45, transactions: [] } },
    monthly: { [today.slice(0, 7)]: { spent: 45, transactions: [] } },
    byFeature: {},
    byModel: {},
    updatedAt: new Date().toISOString(),
  });

  const result = ogu('route:select', ['--capability', 'architecture', '--budget-aware', '--json']);
  assertEqual(result.exitCode, 0, 'route:select should exit 0');
  const route = JSON.parse(result.stdout);
  // With only $5 remaining, should prefer sonnet ($0.015/1k) over opus ($0.075/1k)
  assertEqual(route.model, 'claude-sonnet-4-20250514', 'Should pick sonnet when budget is tight');
  assert(route.budgetConstrained === true, 'Should flag as budget-constrained');
});

// ── Part 4: Task Retry ──

console.log('\n\x1b[36m  Part 4: Task Retry\x1b[0m');

await test('agent:run retries failed task up to maxRetries', async () => {
  // Reset budget
  const today = new Date().toISOString().slice(0, 10);
  writeJSON('.ogu/budget/budget-state.json', {
    version: 1,
    daily: { [today]: { spent: 0, transactions: [] } },
    monthly: { [today.slice(0, 7)]: { spent: 0, transactions: [] } },
    byFeature: {},
    byModel: {},
    updatedAt: new Date().toISOString(),
  });

  // Create a feature for retry testing
  ogu('feature:state', ['slice6-retry-test', 'idea']);

  const result = ogu('agent:run', [
    '--feature', 'slice6-retry-test',
    '--task', 'retry-task-001',
    '--dry-run',
    '--simulate-failure', '2', // Fail first 2 attempts, succeed on 3rd
  ]);

  assertEqual(result.exitCode, 0, 'Should eventually succeed after retries');
  assert(
    result.stdout.includes('retry') || result.stdout.includes('attempt'),
    `Should mention retries: ${result.stdout.trim()}`
  );
});

await test('retry audit trail shows all attempts', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const retryEvents = events.filter(e =>
    e.type === 'agent.retry' && e.payload?.taskId === 'retry-task-001'
  );
  assert(retryEvents.length >= 1, `Should have retry events, got ${retryEvents.length}`);
});

// ── Part 5: Escalation ──

console.log('\n\x1b[36m  Part 5: Escalation\x1b[0m');

await test('agent:run escalates to higher tier on failure', async () => {
  const result = ogu('agent:run', [
    '--feature', 'slice6-retry-test',
    '--task', 'escalate-task-001',
    '--dry-run',
    '--simulate-failure', '1',  // Fail once at current tier
    '--tier', 'fast',           // Start at fast tier
  ]);

  assertEqual(result.exitCode, 0, 'Should succeed after escalation');
  assert(
    result.stdout.includes('escalat') || result.stdout.includes('standard') || result.stdout.includes('upgraded'),
    `Should mention escalation: ${result.stdout.trim()}`
  );
});

await test('escalation audit trail shows tier change', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const escalation = events.find(e =>
    e.type === 'agent.escalation' && e.payload?.taskId === 'escalate-task-001'
  );
  assert(escalation, 'Should have escalation audit event');
  assert(escalation.payload.fromTier === 'fast', `Should escalate from fast, got ${escalation.payload.fromTier}`);
  assert(
    escalation.payload.toTier === 'standard' || escalation.payload.toTier === 'advanced',
    `Should escalate to standard or advanced, got ${escalation.payload.toTier}`
  );
});

await test('escalation respects maxRetries limit', async () => {
  const result = ogu('agent:run', [
    '--feature', 'slice6-retry-test',
    '--task', 'fail-all-tiers',
    '--dry-run',
    '--simulate-failure', '99', // Always fail
    '--tier', 'fast',
  ]);

  assert(result.exitCode !== 0, 'Should fail after exhausting all retries and tiers');
  assert(
    result.stdout.includes('exhausted') || result.stdout.includes('failed') || result.stderr.includes('exhausted'),
    `Should report exhausted retries`
  );
});

// ── Part 6: Per-Model Budget Tracking ──

console.log('\n\x1b[36m  Part 6: Per-Model Budget Tracking\x1b[0m');

await test('budget tracks spending per model', async () => {
  const result = ogu('budget:status', ['--json']);
  assertEqual(result.exitCode, 0, 'budget:status should exit 0');
  const budget = JSON.parse(result.stdout);
  assert(budget.byModel, 'Should have byModel breakdown');
});

await test('budget tracks spending per feature', async () => {
  const result = ogu('budget:status', ['--json']);
  assertEqual(result.exitCode, 0, 'budget:status should exit 0');
  const budget = JSON.parse(result.stdout);
  assert(budget.byFeature, 'Should have byFeature breakdown');
});

// ── Cleanup ──

const featureState = join(ROOT, '.ogu/state/features/slice6-retry-test.state.json');
if (existsSync(featureState)) rmSync(featureState);

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
