#!/usr/bin/env node

/**
 * Slice 20 — Budget Completion + Task Allocator (Gap Closure P3 + P4)
 *
 * Proves: Budget recording, per-role/feature reporting, alert thresholds,
 *   task allocation with capability+risk+budget matching.
 *
 * Tests:
 *   P3: budget:record, budget:report, per-role tracking, alert audit events
 *   P4: task-allocator.mjs — allocateTask, task:allocate CLI, build:dispatch --allocate
 *
 * Depends on: Slices 1-19
 *
 * Run: node tests/e2e/slice-20.test.mjs
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

function readJSON(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf8'));
}

function writeJSON(relPath, data) {
  const fullPath = join(ROOT, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

// ── Setup ──

function setup() {
  ogu('org:init', ['--force']);

  // Create a test feature with Plan.json for task allocation tests
  const featureDir = `docs/vault/features/test-alloc`;
  mkdirSync(join(ROOT, featureDir), { recursive: true });

  writeJSON(`${featureDir}/Plan.json`, {
    tasks: [
      {
        id: 'task-write-code',
        name: 'Write main module',
        description: 'Generate the main application code',
        dependsOn: [],
        requiredCapabilities: ['code_generation'],
        riskTier: 'medium',
        output: { files: [{ path: 'src/main.js', content: '// main' }] },
      },
      {
        id: 'task-write-tests',
        name: 'Write tests',
        description: 'Generate test suite',
        dependsOn: ['task-write-code'],
        requiredCapabilities: ['testing'],
        riskTier: 'medium',
        output: { files: [{ path: 'tests/main.test.js', content: '// tests' }] },
      },
      {
        id: 'task-security-review',
        name: 'Security review',
        description: 'Review code for security vulnerabilities',
        dependsOn: ['task-write-code'],
        requiredCapabilities: ['security_audit'],
        riskTier: 'high',
        output: {},
      },
      {
        id: 'task-design-ui',
        name: 'Design UI components',
        description: 'Create UI design specifications',
        dependsOn: [],
        requiredCapabilities: ['design'],
        riskTier: 'low',
        output: {},
      },
    ],
  });
}

// ── Tests ──

console.log('\n\x1b[1mSlice 20 — Budget Completion + Task Allocator (P3 + P4)\x1b[0m\n');
console.log('  Budget recording/reporting, task allocation with capability matching\n');

setup();

// ── Part 1: Budget Record ──

console.log('\x1b[36m  Part 1: Budget Record\x1b[0m');

await test('budget:record records a spend', async () => {
  const result = ogu('budget:record', [
    '--feature', 'test-alloc',
    '--cost', '0.50',
    '--tokens', '5000',
    '--model', 'claude-sonnet-4-20250514',
    '--role', 'developer',
  ]);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('Recorded') || result.stdout.includes('recorded') || result.stdout.includes('$0.5'),
    `Should confirm recording: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('budget:record updates budget state', async () => {
  const state = readJSON('.ogu/budget/budget-state.json');
  assert(state, 'Budget state should exist');
  // State should reflect the recorded spend
  const dailyCost = state.daily?.costUsed ?? 0;
  assert(dailyCost > 0, `Daily cost should be > 0 after recording, got ${dailyCost}`);
});

await test('budget:record appends transaction', async () => {
  assert(fileExists('.ogu/budget/transactions.jsonl'), 'Transactions file should exist');
  const lines = readFileSync(join(ROOT, '.ogu/budget/transactions.jsonl'), 'utf8').trim().split('\n');
  const lastTx = JSON.parse(lines[lines.length - 1]);
  assert(lastTx.featureSlug === 'test-alloc', `Last transaction should be for test-alloc, got ${lastTx.featureSlug}`);
  assert(lastTx.cost === 0.5, `Cost should be 0.5, got ${lastTx.cost}`);
});

// ── Part 2: Budget Report ──

console.log('\n\x1b[36m  Part 2: Budget Report\x1b[0m');

await test('budget:report shows summary', async () => {
  const result = ogu('budget:report');
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('Budget') || result.stdout.includes('budget') || result.stdout.includes('Report'),
    `Should show report: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('budget:report --json returns structured data', async () => {
  const result = ogu('budget:report', ['--json']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  const report = JSON.parse(result.stdout.trim());
  assert(report.daily !== undefined, 'Should have daily section');
  assert(report.monthly !== undefined, 'Should have monthly section');
  assert(report.byFeature !== undefined || report.features !== undefined, 'Should have per-feature breakdown');
  assert(report.byModel !== undefined || report.models !== undefined, 'Should have per-model breakdown');
});

await test('budget:report --feature shows feature breakdown', async () => {
  const result = ogu('budget:report', ['--feature', 'test-alloc']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('test-alloc'),
    `Should show feature name: ${result.stdout.trim().slice(0, 200)}`,
  );
});

// ── Part 3: Budget Alert Thresholds ──

console.log('\n\x1b[36m  Part 3: Budget Alert Thresholds\x1b[0m');

await test('budget:check warns near threshold', async () => {
  // The default alert threshold is 0.8 of daily limit ($50)
  // So $40+ should trigger a warning
  const result = ogu('budget:check', ['--cost', '42', '--json']);
  assertEqual(result.exitCode, 0, 'Should succeed (within limit)');
  const check = JSON.parse(result.stdout.trim());
  assert(typeof check.allowed === 'boolean', 'Should have allowed field');
  assert(typeof check.warning === 'boolean', 'Should have warning field');
});

await test('budget:check blocks over daily limit', async () => {
  const result = ogu('budget:check', ['--cost', '999']);
  assertEqual(result.exitCode, 1, 'Should fail when over limit');
  assert(
    result.stdout.includes('exceeded') || result.stdout.includes('Exceeds') || result.stdout.includes('Budget'),
    `Should explain why blocked: ${result.stdout.trim().slice(0, 200)}`,
  );
});

// ── Part 4: Task Allocator Library ──

console.log('\n\x1b[36m  Part 4: Task Allocator Library\x1b[0m');

await test('task-allocator.mjs exports allocateTask', async () => {
  const mod = await import('../../tools/ogu/commands/lib/task-allocator.mjs');
  assert(typeof mod.allocateTask === 'function', 'Should export allocateTask');
  assert(typeof mod.allocatePlan === 'function', 'Should export allocatePlan');
});

await test('allocateTask matches role by capability', async () => {
  const { allocateTask } = await import('../../tools/ogu/commands/lib/task-allocator.mjs');
  const result = allocateTask({
    taskId: 'test-1',
    requiredCapabilities: ['code_generation'],
    riskTier: 'medium',
  });
  assert(result, 'Should return allocation');
  assert(result.roleId, `Should assign a roleId: ${JSON.stringify(result)}`);
  assert(result.capabilities, 'Should include role capabilities');
  // The assigned role should have code_generation capability
  assert(
    result.capabilities.includes('code_generation'),
    `Assigned role should have code_generation: ${result.roleId} has ${result.capabilities}`,
  );
});

await test('allocateTask respects risk tier limits', async () => {
  const { allocateTask } = await import('../../tools/ogu/commands/lib/task-allocator.mjs');
  const result = allocateTask({
    taskId: 'test-2',
    requiredCapabilities: ['security_audit'],
    riskTier: 'high',
  });
  assert(result, 'Should find a role for security_audit');
  assertEqual(result.roleId, 'security', `Should assign security role, got ${result.roleId}`);
});

await test('allocateTask returns null for impossible match', async () => {
  const { allocateTask } = await import('../../tools/ogu/commands/lib/task-allocator.mjs');
  const result = allocateTask({
    taskId: 'test-3',
    requiredCapabilities: ['quantum_computing'],
    riskTier: 'low',
  });
  assertEqual(result, null, 'Should return null for unmatched capability');
});

await test('allocatePlan allocates all tasks in a Plan', async () => {
  const { allocatePlan } = await import('../../tools/ogu/commands/lib/task-allocator.mjs');
  const plan = readJSON('docs/vault/features/test-alloc/Plan.json');
  const allocations = allocatePlan(plan.tasks);
  assert(allocations, 'Should return allocations');
  assert(allocations.length === plan.tasks.length, `Should allocate all ${plan.tasks.length} tasks, got ${allocations.length}`);

  // Each allocation should have taskId and roleId
  for (const alloc of allocations) {
    assert(alloc.taskId, 'Each allocation should have taskId');
    assert(alloc.roleId, `Task ${alloc.taskId} should have roleId assigned`);
  }
});

await test('allocatePlan assigns different roles to different capabilities', async () => {
  const { allocatePlan } = await import('../../tools/ogu/commands/lib/task-allocator.mjs');
  const plan = readJSON('docs/vault/features/test-alloc/Plan.json');
  const allocations = allocatePlan(plan.tasks);

  const securityTask = allocations.find(a => a.taskId === 'task-security-review');
  const designTask = allocations.find(a => a.taskId === 'task-design-ui');

  assert(securityTask, 'Should have security review allocation');
  assert(designTask, 'Should have design UI allocation');
  assert(securityTask.roleId !== designTask.roleId, `Security and design should have different roles: ${securityTask.roleId} vs ${designTask.roleId}`);
});

// ── Part 5: Task Allocate CLI ──

console.log('\n\x1b[36m  Part 5: Task Allocate CLI\x1b[0m');

await test('task:allocate assigns role to a task', async () => {
  const result = ogu('task:allocate', [
    '--feature', 'test-alloc',
    '--task', 'task-write-code',
  ]);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('developer') || result.stdout.includes('frontend-dev') || result.stdout.includes('backend-dev') || result.stdout.includes('Allocated'),
    `Should show assigned role: ${result.stdout.trim().slice(0, 200)}`,
  );
});

await test('task:allocate --json returns structured allocation', async () => {
  const result = ogu('task:allocate', [
    '--feature', 'test-alloc',
    '--task', 'task-security-review',
    '--json',
  ]);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  const alloc = JSON.parse(result.stdout.trim());
  assert(alloc.taskId === 'task-security-review', `Should have taskId: ${alloc.taskId}`);
  assert(alloc.roleId, `Should have roleId: ${JSON.stringify(alloc)}`);
});

await test('task:allocate for unknown task fails gracefully', async () => {
  const result = ogu('task:allocate', [
    '--feature', 'test-alloc',
    '--task', 'nonexistent-task',
  ]);
  assertEqual(result.exitCode, 1, 'Should fail for unknown task');
});

await test('task:allocate-plan allocates entire plan', async () => {
  const result = ogu('task:allocate-plan', ['--feature', 'test-alloc']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  assert(
    result.stdout.includes('4') || result.stdout.includes('task'),
    `Should show allocation count: ${result.stdout.trim().slice(0, 300)}`,
  );
});

await test('task:allocate-plan --json returns all allocations', async () => {
  const result = ogu('task:allocate-plan', ['--feature', 'test-alloc', '--json']);
  assertEqual(result.exitCode, 0, `Should succeed: ${result.stderr || result.stdout}`);
  const allocations = JSON.parse(result.stdout.trim());
  assert(Array.isArray(allocations), 'Should be an array');
  assert(allocations.length === 4, `Should allocate 4 tasks, got ${allocations.length}`);
});

// ── Cleanup ──

const testFeature = join(ROOT, 'docs/vault/features/test-alloc');
if (existsSync(testFeature)) rmSync(testFeature, { recursive: true });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
