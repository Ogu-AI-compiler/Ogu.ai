#!/usr/bin/env node

/**
 * Slice 9 — Observability API + Metrics E2E Test
 *
 * Proves: Kadima's HTTP API serves rich observability data
 *   that Studio (or any client) can consume.
 *
 * Tests hit the live daemon API endpoints:
 *   GET /api/features           — list all features
 *   GET /api/features/:slug/timeline — event timeline
 *   GET /api/compile/:slug/report    — compile report
 *   GET /api/metrics            — system-wide metrics
 *   GET /health                 — extended health
 *   GET /api/budget             — budget summary
 *
 * Depends on: Slices 1-8 (especially Slice 8 which created compile reports)
 *
 * Run: node tests/e2e/slice-9.test.mjs
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Helpers ──

const CLI = join(import.meta.dirname, '../../tools/ogu/cli.mjs');
const ROOT = join(import.meta.dirname, '../../');
const API = 'http://127.0.0.1:4200';

function ogu(command, args = []) {
  try {
    const output = execFileSync('node', [CLI, command, ...args], {
      cwd: ROOT, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, OGU_ROOT: ROOT, NODE_NO_WARNINGS: '1' },
    });
    return { exitCode: 0, stdout: output, stderr: '' };
  } catch (err) {
    return { exitCode: err.status ?? 1, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

function writeJSON(relPath, data) {
  const fullPath = join(ROOT, relPath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
}

async function api(path) {
  const resp = await fetch(`${API}${path}`);
  const body = await resp.json();
  return { status: resp.status, body };
}

// ── Setup ──

const FEATURE = 'obs-test-feature';

function setup() {
  ogu('org:init', ['--minimal', '--force']);

  writeJSON('.ogu/kadima.config.json', {
    version: 1,
    loops: {
      scheduler: { intervalMs: 1000, enabled: true },
      stateMachine: { intervalMs: 1000, enabled: true },
    },
    api: { host: '127.0.0.1', port: 4200, metricsPort: 4201 },
    runners: { maxConcurrent: 4, spawnMode: 'local', timeoutMs: 30000 },
  });

  // Create a feature with state
  ogu('feature:state', [FEATURE, 'idea']);
  ogu('feature:state', [FEATURE, 'specifying']);
  ogu('feature:state', [FEATURE, 'specified']);

  // Create a compile report fixture
  writeJSON(`.ogu/reports/${FEATURE}.compile.json`, {
    featureSlug: FEATURE,
    result: 'PASS',
    compiledAt: new Date().toISOString(),
    timing: { totalMs: 1234, buildMs: 1000, verifyMs: 234 },
    tasks: { total: 2, completed: 2 },
    gates: [
      { name: 'file-exists: src/test.mjs', type: 'file-exists', passed: true, message: 'OK', durationMs: 1 },
    ],
    drift: { drifted: false, failedChecks: 0, totalChecks: 1, details: [] },
  });

  // Create budget state
  const today = new Date().toISOString().slice(0, 10);
  writeJSON('.ogu/budget/budget-state.json', {
    version: 1,
    daily: { [today]: { spent: 12.50, transactions: [] } },
    monthly: { [today.slice(0, 7)]: { spent: 87.25, transactions: [] } },
    byFeature: { [FEATURE]: { spent: 5.00 } },
    byModel: { 'anthropic/claude-sonnet-4-20250514': { spent: 12.50, calls: 8 } },
    updatedAt: new Date().toISOString(),
  });
}

function cleanup() {
  ogu('kadima:stop');
  const featureState = join(ROOT, `.ogu/state/features/${FEATURE}.state.json`);
  if (existsSync(featureState)) rmSync(featureState);
  const report = join(ROOT, `.ogu/reports/${FEATURE}.compile.json`);
  if (existsSync(report)) rmSync(report);
}

// ── Ensure clean ──
ogu('kadima:stop');

// ── Tests ──

console.log('\n\x1b[1mSlice 9 — Observability API + Metrics E2E Test\x1b[0m\n');
console.log('  Live HTTP API endpoints for Studio integration\n');

setup();

// Start daemon
console.log('\x1b[36m  Setup: Starting Kadima daemon\x1b[0m');

await test('kadima:start for API tests', async () => {
  const result = ogu('kadima:start');
  assertEqual(result.exitCode, 0, 'kadima:start should exit 0');
  await sleep(1500);
});

// ── Part 1: Extended Health ──

console.log('\n\x1b[36m  Part 1: Extended Health\x1b[0m');

await test('GET /health returns extended info', async () => {
  const { status, body } = await api('/health');
  assertEqual(status, 200, 'Should return 200');
  assertEqual(body.status, 'healthy', 'Should be healthy');
  assert(typeof body.pid === 'number', 'Should have pid');
  assert(typeof body.uptime === 'number', 'Should have uptime');
  assert(body.loops, 'Should have loops info');
  assert(body.runners, 'Should have runners info');
});

await test('/health includes memory usage', async () => {
  const { body } = await api('/health');
  assert(body.memory, 'Should have memory info');
  assert(typeof body.memory.heapUsedMB === 'number', 'Should have heapUsedMB');
});

// ── Part 2: Features API ──

console.log('\n\x1b[36m  Part 2: Features API\x1b[0m');

await test('GET /api/features lists all features', async () => {
  const { status, body } = await api('/api/features');
  assertEqual(status, 200, 'Should return 200');
  assert(Array.isArray(body.features), 'Should return features array');
  assert(body.features.length >= 1, `Should have at least 1 feature, got ${body.features.length}`);
});

await test('/api/features includes feature states', async () => {
  const { body } = await api('/api/features');
  const feat = body.features.find(f => f.slug === FEATURE);
  assert(feat, `Should find ${FEATURE} in list`);
  assertEqual(feat.currentState, 'specified', 'Should show current state');
});

// ── Part 3: Feature Timeline ──

console.log('\n\x1b[36m  Part 3: Feature Timeline\x1b[0m');

await test('GET /api/features/:slug/timeline returns events', async () => {
  const { status, body } = await api(`/api/features/${FEATURE}/timeline`);
  assertEqual(status, 200, 'Should return 200');
  assert(Array.isArray(body.events), 'Should return events array');
  assert(body.events.length >= 1, `Should have events, got ${body.events.length}`);
});

await test('timeline events are chronologically ordered', async () => {
  const { body } = await api(`/api/features/${FEATURE}/timeline`);
  for (let i = 1; i < body.events.length; i++) {
    const prev = new Date(body.events[i - 1].timestamp).getTime();
    const curr = new Date(body.events[i].timestamp).getTime();
    assert(curr >= prev, `Events should be chronological at index ${i}`);
  }
});

await test('timeline includes feature.transition events', async () => {
  const { body } = await api(`/api/features/${FEATURE}/timeline`);
  const transitions = body.events.filter(e => e.type === 'feature.transition');
  assert(transitions.length >= 1, `Should have transition events, got ${transitions.length}`);
});

// ── Part 4: Compile Report API ──

console.log('\n\x1b[36m  Part 4: Compile Report API\x1b[0m');

await test('GET /api/compile/:slug/report returns report', async () => {
  const { status, body } = await api(`/api/compile/${FEATURE}/report`);
  assertEqual(status, 200, 'Should return 200');
  assertEqual(body.featureSlug, FEATURE, 'Should match feature slug');
  assertEqual(body.result, 'PASS', 'Should show PASS result');
});

await test('compile report includes gates and timing', async () => {
  const { body } = await api(`/api/compile/${FEATURE}/report`);
  assert(body.gates, 'Should have gates');
  assert(body.timing, 'Should have timing');
  assert(typeof body.timing.totalMs === 'number', 'Should have totalMs');
});

await test('GET /api/compile/nonexistent/report returns 404', async () => {
  const { status } = await api('/api/compile/does-not-exist/report');
  assertEqual(status, 404, 'Should return 404 for missing report');
});

// ── Part 5: Metrics API ──

console.log('\n\x1b[36m  Part 5: Metrics API\x1b[0m');

await test('GET /api/metrics returns system metrics', async () => {
  const { status, body } = await api('/api/metrics');
  assertEqual(status, 200, 'Should return 200');
  assert(typeof body.features === 'object', 'Should have features metrics');
  assert(typeof body.budget === 'object', 'Should have budget metrics');
  assert(typeof body.scheduler === 'object', 'Should have scheduler metrics');
});

await test('metrics include feature state counts', async () => {
  const { body } = await api('/api/metrics');
  assert(typeof body.features.total === 'number', 'Should have total features count');
  assert(body.features.byState, 'Should have byState breakdown');
});

await test('metrics include budget summary', async () => {
  const { body } = await api('/api/metrics');
  assert(typeof body.budget.dailySpent === 'number', 'Should have dailySpent');
  assert(typeof body.budget.dailyLimit === 'number', 'Should have dailyLimit');
});

await test('metrics include scheduler stats', async () => {
  const { body } = await api('/api/metrics');
  assert(typeof body.scheduler.totalTasks === 'number', 'Should have totalTasks');
  assert(typeof body.scheduler.completedTasks === 'number', 'Should have completedTasks');
});

// ── Part 6: Budget API ──

console.log('\n\x1b[36m  Part 6: Budget API\x1b[0m');

await test('GET /api/budget returns budget summary', async () => {
  const { status, body } = await api('/api/budget');
  assertEqual(status, 200, 'Should return 200');
  assert(typeof body.dailySpent === 'number', 'Should have dailySpent');
  assert(body.byModel, 'Should have byModel breakdown');
  assert(body.byFeature, 'Should have byFeature breakdown');
});

// ── Cleanup ──

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
