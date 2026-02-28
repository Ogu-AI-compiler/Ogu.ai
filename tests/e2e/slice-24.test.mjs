#!/usr/bin/env node

/**
 * Slice 24 — Isolation Levels + Auto-Retry with DAG Rewind (Gap Closure P12 + P13)
 *
 * Proves: Task isolation levels (L0-L3), auto-retry with escalation
 *   and DAG rewind on failure.
 *
 * Tests:
 *   P12: isolation-manager.mjs — L0 (none), L1 (branch), L2 (worktree), L3 (container)
 *   P13: auto-retry integration — retry loop with escalation and rewind
 *
 * Depends on: Slices 1-23
 *
 * Run: node tests/e2e/slice-24.test.mjs
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
  try {
    const output = execFileSync('node', [CLI, command, ...args], {
      cwd: ROOT, encoding: 'utf8', timeout: 15000,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, OGU_ROOT: ROOT, NODE_NO_WARNINGS: '1' },
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { exitCode: err.status ?? 1, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

// ── Setup ──

function setup() {
  ogu('org:init', ['--force']);
}

// ── Tests ──

console.log('\n\x1b[1mSlice 24 — Isolation Levels + Auto-Retry (P12 + P13)\x1b[0m\n');
console.log('  Task isolation L0-L3, auto-retry with escalation and DAG rewind\n');

setup();

// ── Part 1: Isolation Manager Library ──

console.log('\x1b[36m  Part 1: Isolation Manager Library\x1b[0m');

await test('isolation-manager.mjs exports core functions', async () => {
  const mod = await import('../../tools/ogu/commands/lib/isolation-manager.mjs');
  assert(typeof mod.resolveIsolation === 'function', 'Should export resolveIsolation');
  assert(typeof mod.describeLevel === 'function', 'Should export describeLevel');
  assert(typeof mod.ISOLATION_LEVELS === 'object', 'Should export ISOLATION_LEVELS');
});

await test('ISOLATION_LEVELS defines L0 through L3', async () => {
  const { ISOLATION_LEVELS } = await import('../../tools/ogu/commands/lib/isolation-manager.mjs');
  assert(ISOLATION_LEVELS.L0, 'Should have L0');
  assert(ISOLATION_LEVELS.L1, 'Should have L1');
  assert(ISOLATION_LEVELS.L2, 'Should have L2');
  assert(ISOLATION_LEVELS.L3, 'Should have L3');
});

await test('resolveIsolation picks level based on risk tier', async () => {
  const { resolveIsolation } = await import('../../tools/ogu/commands/lib/isolation-manager.mjs');

  const low = resolveIsolation({ riskTier: 'low', touches: ['docs/readme.md'] });
  assertEqual(low.level, 'L0', `Low risk should be L0, got ${low.level}`);

  const medium = resolveIsolation({ riskTier: 'medium', touches: ['src/main.js'] });
  assert(medium.level === 'L0' || medium.level === 'L1', `Medium risk should be L0 or L1, got ${medium.level}`);

  const high = resolveIsolation({ riskTier: 'high', touches: ['src/core/auth.js'] });
  assert(high.level === 'L1' || high.level === 'L2', `High risk should be L1 or L2, got ${high.level}`);

  const critical = resolveIsolation({ riskTier: 'critical', touches: ['server/db.js'] });
  assert(critical.level === 'L2' || critical.level === 'L3', `Critical should be L2 or L3, got ${critical.level}`);
});

await test('resolveIsolation escalates for sensitive paths', async () => {
  const { resolveIsolation } = await import('../../tools/ogu/commands/lib/isolation-manager.mjs');

  const sensitive = resolveIsolation({ riskTier: 'low', touches: ['.env', 'secrets/key.pem'] });
  assert(sensitive.level !== 'L0', `Sensitive paths should escalate beyond L0, got ${sensitive.level}`);
});

await test('describeLevel returns human-readable description', async () => {
  const { describeLevel } = await import('../../tools/ogu/commands/lib/isolation-manager.mjs');

  const desc = describeLevel('L0');
  assert(desc.name, 'Should have name');
  assert(desc.description, 'Should have description');
  assert(desc.mergeStrategy, 'Should have merge strategy');
});

// ── Part 2: Isolation CLI ──

console.log('\n\x1b[36m  Part 2: Isolation CLI\x1b[0m');

await test('isolation:resolve picks level for a task', async () => {
  const result = ogu('isolation:resolve', ['--risk', 'high', '--touches', 'src/core/auth.js']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('L1') || result.stdout.includes('L2') || result.stdout.includes('L3'),
    `Should show level: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('isolation:levels lists all levels', async () => {
  const result = ogu('isolation:levels');
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('L0') && result.stdout.includes('L1') && result.stdout.includes('L2') && result.stdout.includes('L3'),
    `Should list all levels: ${result.stdout.trim().slice(0, 300)}`,
  );
});

// ── Part 3: Auto-Retry with Escalation ──

console.log('\n\x1b[36m  Part 3: Auto-Retry with Escalation\x1b[0m');

await test('auto-retry.mjs exports executeWithRetry', async () => {
  const mod = await import('../../tools/ogu/commands/lib/auto-retry.mjs');
  assert(typeof mod.executeWithRetry === 'function', 'Should export executeWithRetry');
});

await test('executeWithRetry succeeds on first try', async () => {
  const { executeWithRetry } = await import('../../tools/ogu/commands/lib/auto-retry.mjs');
  let callCount = 0;
  const result = await executeWithRetry({
    fn: async () => { callCount++; return { status: 'success', data: 'ok' }; },
    category: 'transient',
  });
  assertEqual(result.status, 'success', 'Should succeed');
  assertEqual(callCount, 1, 'Should call once');
  assertEqual(result.attempts, 1, 'Should report 1 attempt');
});

await test('executeWithRetry retries on transient failure', async () => {
  const { executeWithRetry } = await import('../../tools/ogu/commands/lib/auto-retry.mjs');
  let callCount = 0;
  const result = await executeWithRetry({
    fn: async () => {
      callCount++;
      if (callCount < 3) throw new Error('timeout');
      return { status: 'success', data: 'recovered' };
    },
    category: 'transient',
    maxRetries: 3,
    backoffMs: 10, // fast for testing
  });
  assertEqual(result.status, 'success', 'Should eventually succeed');
  assertEqual(callCount, 3, 'Should have called 3 times');
  assertEqual(result.attempts, 3, 'Should report 3 attempts');
});

await test('executeWithRetry gives up after max retries', async () => {
  const { executeWithRetry } = await import('../../tools/ogu/commands/lib/auto-retry.mjs');
  const result = await executeWithRetry({
    fn: async () => { throw new Error('always fails'); },
    category: 'transient',
    maxRetries: 2,
    backoffMs: 10,
  });
  assertEqual(result.status, 'failed', 'Should fail after retries exhausted');
  assertEqual(result.attempts, 3, 'Should attempt 1 + 2 retries = 3');
});

await test('executeWithRetry does not retry budget errors', async () => {
  const { executeWithRetry } = await import('../../tools/ogu/commands/lib/auto-retry.mjs');
  let callCount = 0;
  const result = await executeWithRetry({
    fn: async () => { callCount++; throw new Error('budget exceeded'); },
    category: 'budget',
    backoffMs: 10,
  });
  assertEqual(result.status, 'failed', 'Should fail immediately');
  assertEqual(callCount, 1, 'Should only call once for budget errors');
});

await test('executeWithRetry reports escalation flag for quality', async () => {
  const { executeWithRetry } = await import('../../tools/ogu/commands/lib/auto-retry.mjs');
  const result = await executeWithRetry({
    fn: async () => { throw new Error('quality check failed'); },
    category: 'quality',
    maxRetries: 1,
    backoffMs: 10,
  });
  assertEqual(result.status, 'failed', 'Should fail');
  assert(result.shouldEscalate === true, 'Should flag for escalation');
});

// ── Part 4: DAG Rewind CLI ──

console.log('\n\x1b[36m  Part 4: DAG Rewind CLI\x1b[0m');

await test('recover:rewind computes rewind point', async () => {
  // Create test feature with Plan.json
  const featureDir = 'docs/vault/features/test-rewind';
  mkdirSync(join(ROOT, featureDir), { recursive: true });
  writeFileSync(join(ROOT, featureDir, 'Plan.json'), JSON.stringify({
    tasks: [
      { id: 'init', name: 'Init', dependsOn: [], requiredCapabilities: ['code_generation'] },
      { id: 'build', name: 'Build', dependsOn: ['init'], requiredCapabilities: ['code_generation'] },
      { id: 'test', name: 'Test', dependsOn: ['build'], requiredCapabilities: ['testing'] },
    ],
  }, null, 2), 'utf8');

  const result = ogu('recover:rewind', ['--feature', 'test-rewind', '--task', 'test']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('rewind') || result.stdout.includes('Rewind') || result.stdout.includes('wave'),
    `Should show rewind info: ${result.stdout.trim().slice(0, 200)}`,
  );

  // Cleanup
  rmSync(join(ROOT, featureDir), { recursive: true });
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
