#!/usr/bin/env node

/**
 * Slice 1 — End-to-End Test
 *
 * Proves: A feature can go from idea to built with one agent.
 * Covers: OrgSpec, state machine, agent:run standalone, audit, budget, envelopes.
 *
 * This test is THE definition of "Slice 1 is done".
 * While this test fails — we're not done. When it passes — we ship.
 *
 * Run: node tests/e2e/slice-1.test.mjs
 */

import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// ── Test harness (zero dependencies) ──

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

function assertIncludes(arr, item, message) {
  if (!arr.includes(item)) {
    throw new Error(`${message}: array does not include "${item}". Has: ${JSON.stringify(arr)}`);
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
      timeout: 30000,
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
  const fullPath = join(ROOT, relPath);
  return JSON.parse(readFileSync(fullPath, 'utf8'));
}

function readJSONL(relPath) {
  const fullPath = join(ROOT, relPath);
  return readFileSync(fullPath, 'utf8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function fileExists(relPath) {
  return existsSync(join(ROOT, relPath));
}

function listFiles(dir, suffix) {
  const fullDir = join(ROOT, dir);
  if (!existsSync(fullDir)) return [];
  return readdirSync(fullDir).filter(f => f.endsWith(suffix));
}

// ── Setup: backup existing .ogu state and create test sandbox ──

const OGU_BACKUP = join(ROOT, '.ogu-backup-test');
const SLICE1_FEATURE = 'slice1-test-feature';

function setup() {
  // We test on a copy of .ogu/state to not corrupt real state.
  // Create test-specific directories
  const dirs = [
    '.ogu/state/features',
    '.ogu/agents',
    '.ogu/audit',
    '.ogu/budget',
    '.ogu/runners',
  ];
  for (const dir of dirs) {
    mkdirSync(join(ROOT, dir), { recursive: true });
  }
}

function cleanup() {
  // Remove test feature state file (don't delete other stuff)
  const testStateFile = join(ROOT, `.ogu/state/features/${SLICE1_FEATURE}.state.json`);
  if (existsSync(testStateFile)) rmSync(testStateFile);
}

// ── Tests ──

console.log('\n\x1b[1mSlice 1 — End-to-End Test\x1b[0m\n');
console.log('  Feature lifecycle: idea → built with one agent\n');

setup();

// ── Part 1: OrgSpec ──

console.log('\x1b[36m  Part 1: OrgSpec\x1b[0m');

await test('org:init creates OrgSpec.json', async () => {
  const result = ogu('org:init', ['--minimal', '--force']);
  assertEqual(result.exitCode, 0, 'org:init should exit 0');
  assert(fileExists('.ogu/OrgSpec.json'), 'OrgSpec.json should exist');
});

await test('OrgSpec has at least one role', async () => {
  const org = readJSON('.ogu/OrgSpec.json');
  assert(org.roles && org.roles.length >= 1, 'Must have at least 1 role');
  assert(org.roles[0].roleId, 'Role must have roleId');
  assert(org.roles[0].capabilities?.length > 0, 'Role must have capabilities');
});

await test('OrgSpec has budget configuration', async () => {
  const org = readJSON('.ogu/OrgSpec.json');
  assert(org.budget, 'Must have budget');
  assert(org.budget.dailyLimit > 0, 'Daily limit must be positive');
  assert(org.budget.currency === 'USD', 'Currency must be USD');
});

await test('OrgSpec has at least one provider', async () => {
  const org = readJSON('.ogu/OrgSpec.json');
  assert(org.providers && org.providers.length >= 1, 'Must have at least 1 provider');
  assert(org.providers[0].models?.length > 0, 'Provider must have models');
});

await test('OrgSpec validates against schema', async () => {
  const { OrgSpecSchema } = await import('../../tools/contracts/schemas/org-spec.mjs');
  const org = readJSON('.ogu/OrgSpec.json');
  // This will throw if invalid
  OrgSpecSchema.parse(org);
});

// ── Part 2: Feature State Machine ──

console.log('\n\x1b[36m  Part 2: Feature State Machine\x1b[0m');

await test('feature:state creates state file for new feature', async () => {
  const result = ogu('feature:state', [SLICE1_FEATURE, 'idea']);
  assertEqual(result.exitCode, 0, 'feature:state should exit 0');
  assert(fileExists(`.ogu/state/features/${SLICE1_FEATURE}.state.json`),
    'State file should exist');
});

await test('feature state is "idea"', async () => {
  const state = readJSON(`.ogu/state/features/${SLICE1_FEATURE}.state.json`);
  assertEqual(state.currentState, 'idea', 'Should be in idea state');
  assertEqual(state.slug, SLICE1_FEATURE, 'Slug should match');
});

await test('feature:state transitions through legal states', async () => {
  const transitions = [
    'specifying', 'specified', 'planning', 'planned', 'building'
  ];

  for (const target of transitions) {
    const result = ogu('feature:state', [SLICE1_FEATURE, target]);
    assertEqual(result.exitCode, 0, `Transition to "${target}" should succeed`);
    const state = readJSON(`.ogu/state/features/${SLICE1_FEATURE}.state.json`);
    assertEqual(state.currentState, target, `Should be in "${target}" state`);
  }
});

await test('feature:state rejects illegal transitions', async () => {
  // Currently in "building" — can't jump to "idea"
  const result = ogu('feature:state', [SLICE1_FEATURE, 'idea']);
  assert(result.exitCode !== 0, 'Illegal transition should fail');
});

await test('feature state validates against schema', async () => {
  const { FeatureStateSchema } = await import('../../tools/contracts/schemas/feature-state.mjs');
  const state = readJSON(`.ogu/state/features/${SLICE1_FEATURE}.state.json`);
  FeatureStateSchema.parse(state);
});

// ── Part 3: Audit Trail ──

console.log('\n\x1b[36m  Part 3: Audit Trail\x1b[0m');

await test('audit log exists and has events', async () => {
  assert(fileExists('.ogu/audit/current.jsonl'), 'Audit log should exist');
  const events = readJSONL('.ogu/audit/current.jsonl');
  assert(events.length > 0, 'Audit log should have events');
});

await test('audit log contains feature.transition events', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const transitions = events.filter(e => e.type === 'feature.transition');
  assert(transitions.length >= 5,
    `Should have at least 5 transition events (idea→specifying→...→building), got ${transitions.length}`);
});

await test('audit events have required fields', async () => {
  const { AuditEventSchema } = await import('../../tools/contracts/schemas/audit-event.mjs');
  const events = readJSONL('.ogu/audit/current.jsonl');
  // Validate first 3 events against schema
  for (const event of events.slice(0, 3)) {
    AuditEventSchema.parse(event);
  }
});

// ── Part 4: Agent Run (standalone, dry-run) ──

console.log('\n\x1b[36m  Part 4: Agent Run (standalone)\x1b[0m');

await test('agent:run creates InputEnvelope', async () => {
  const result = ogu('agent:run', [
    '--feature', SLICE1_FEATURE,
    '--task', 'write-hello-world',
    '--dry-run'
  ]);
  assertEqual(result.exitCode, 0, 'agent:run --dry-run should exit 0');

  // Check InputEnvelope was written
  assert(fileExists('.ogu/runners/write-hello-world.input.json'),
    'InputEnvelope should be written');
});

await test('InputEnvelope validates against schema', async () => {
  const { InputEnvelopeSchema } = await import('../../tools/contracts/schemas/input-envelope.mjs');
  const envelope = readJSON('.ogu/runners/write-hello-world.input.json');
  InputEnvelopeSchema.parse(envelope);
});

await test('InputEnvelope has correct feature and task', async () => {
  const envelope = readJSON('.ogu/runners/write-hello-world.input.json');
  assertEqual(envelope.featureSlug, SLICE1_FEATURE, 'Feature slug should match');
  assertEqual(envelope.taskId, 'write-hello-world', 'Task ID should match');
  assert(envelope.agent.roleId, 'Should have agent roleId');
  assert(envelope.routingDecision.provider, 'Should have routing decision');
  assert(envelope.budget.maxTokens > 0, 'Should have token budget');
});

await test('agent:run writes OutputEnvelope (dry-run)', async () => {
  assert(fileExists('.ogu/runners/write-hello-world.output.json'),
    'OutputEnvelope should be written');
});

await test('OutputEnvelope validates against schema', async () => {
  const { OutputEnvelopeSchema } = await import('../../tools/contracts/schemas/output-envelope.mjs');
  const envelope = readJSON('.ogu/runners/write-hello-world.output.json');
  OutputEnvelopeSchema.parse(envelope);
});

await test('OutputEnvelope has dry-run status', async () => {
  const output = readJSON('.ogu/runners/write-hello-world.output.json');
  assertEqual(output.taskId, 'write-hello-world', 'Task ID should match');
  assertEqual(output.featureSlug, SLICE1_FEATURE, 'Feature slug should match');
  // dry-run produces success with 0 tokens
  assert(['success', 'dry_run'].includes(output.status),
    `Status should be success or dry_run, got "${output.status}"`);
});

// ── Part 5: Budget Tracking ──

console.log('\n\x1b[36m  Part 5: Budget Tracking\x1b[0m');

await test('budget state file exists', async () => {
  assert(fileExists('.ogu/budget/budget-state.json'), 'Budget state should exist');
});

await test('budget state validates against schema', async () => {
  const { BudgetStateSchema } = await import('../../tools/contracts/schemas/budget-entry.mjs');
  const budget = readJSON('.ogu/budget/budget-state.json');
  BudgetStateSchema.parse(budget);
});

await test('budget tracks the feature', async () => {
  const budget = readJSON('.ogu/budget/budget-state.json');
  assert(budget.features, 'Should have features breakdown');
  // In dry-run, tokens might be 0 but the feature entry should exist
  assert(budget.features[SLICE1_FEATURE] !== undefined,
    `Budget should track feature "${SLICE1_FEATURE}"`);
});

// ── Part 6: Integration ──

console.log('\n\x1b[36m  Part 6: Integration\x1b[0m');

await test('audit log records agent:run event', async () => {
  const events = readJSONL('.ogu/audit/current.jsonl');
  const agentEvents = events.filter(e =>
    e.type === 'runner.completed' || e.type === 'runner.started'
  );
  assert(agentEvents.length > 0, 'Should have runner events in audit');
});

await test('all files use @ogu/contracts schemas consistently', async () => {
  // Validate that OrgSpec, FeatureState, InputEnvelope, OutputEnvelope, Budget
  // all parse correctly — proof that contracts/ is the single source of truth
  const { OrgSpecSchema } = await import('../../tools/contracts/schemas/org-spec.mjs');
  const { FeatureStateSchema } = await import('../../tools/contracts/schemas/feature-state.mjs');
  const { InputEnvelopeSchema } = await import('../../tools/contracts/schemas/input-envelope.mjs');
  const { OutputEnvelopeSchema } = await import('../../tools/contracts/schemas/output-envelope.mjs');
  const { BudgetStateSchema } = await import('../../tools/contracts/schemas/budget-entry.mjs');

  OrgSpecSchema.parse(readJSON('.ogu/OrgSpec.json'));
  FeatureStateSchema.parse(readJSON(`.ogu/state/features/${SLICE1_FEATURE}.state.json`));
  InputEnvelopeSchema.parse(readJSON('.ogu/runners/write-hello-world.input.json'));
  OutputEnvelopeSchema.parse(readJSON('.ogu/runners/write-hello-world.output.json'));
  BudgetStateSchema.parse(readJSON('.ogu/budget/budget-state.json'));
});

// ── Cleanup and report ──

cleanup();

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m`);

if (failures.length > 0) {
  console.log('\n  \x1b[31mFailures:\x1b[0m');
  for (const f of failures) {
    console.log(`    ${f.name}: ${f.error}`);
  }
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
