#!/usr/bin/env node

/**
 * Slice 10 — SSE Event Stream + Live Dashboard
 *
 * Proves: Kadima can push real-time events to connected clients
 *   via Server-Sent Events (SSE), and a dashboard snapshot endpoint
 *   aggregates all system state for Studio rendering.
 *
 * Tests hit the live daemon:
 *   GET /api/events          — SSE stream of real-time events
 *   GET /api/events?feature=X — filtered SSE stream
 *   GET /api/dashboard       — aggregated system snapshot
 *
 * Depends on: Slices 1-9
 *
 * Run: node tests/e2e/slice-10.test.mjs
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

/**
 * Connect to SSE stream, collect events for a duration, then abort.
 * Returns array of parsed event objects.
 */
async function collectSSE(path, durationMs = 3000) {
  const controller = new AbortController();
  const events = [];

  const fetchPromise = fetch(`${API}${path}`, {
    signal: controller.signal,
    headers: { 'Accept': 'text/event-stream' },
  }).then(async (resp) => {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE format: "data: {...}\n\n"
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // keep incomplete part

        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                events.push(JSON.parse(line.slice(6)));
              } catch { /* skip non-JSON data lines */ }
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
    }
  }).catch(err => {
    if (err.name !== 'AbortError') throw err;
  });

  // Wait for events to accumulate, then abort
  await sleep(durationMs);
  controller.abort();
  await fetchPromise.catch(() => {});

  return events;
}

// ── Setup ──

const FEATURE = 'sse-test-feature';

function setup() {
  ogu('org:init', ['--minimal', '--force']);

  writeJSON('.ogu/kadima.config.json', {
    version: 1,
    loops: {
      scheduler: { intervalMs: 500, enabled: true },
      stateMachine: { intervalMs: 500, enabled: true },
    },
    api: { host: '127.0.0.1', port: 4200, metricsPort: 4201 },
    runners: { maxConcurrent: 4, spawnMode: 'local', timeoutMs: 30000 },
  });

  // Create a feature in specified state
  ogu('feature:state', [FEATURE, 'idea']);
  ogu('feature:state', [FEATURE, 'specifying']);
  ogu('feature:state', [FEATURE, 'specified']);

  // Budget state
  const today = new Date().toISOString().slice(0, 10);
  writeJSON('.ogu/budget/budget-state.json', {
    version: 1,
    daily: { [today]: { spent: 15.00, transactions: [] } },
    monthly: { [today.slice(0, 7)]: { spent: 120.00, transactions: [] } },
    byFeature: { [FEATURE]: { spent: 8.00 } },
    byModel: { 'anthropic/claude-sonnet-4-20250514': { spent: 15.00, calls: 10 } },
    updatedAt: new Date().toISOString(),
  });

  // Compile report for completeness
  writeJSON(`.ogu/reports/${FEATURE}.compile.json`, {
    featureSlug: FEATURE,
    result: 'PASS',
    compiledAt: new Date().toISOString(),
    timing: { totalMs: 2000, buildMs: 1500, verifyMs: 500 },
    tasks: { total: 2, completed: 2 },
    gates: [{ name: 'file-exists: src/test.mjs', type: 'file-exists', passed: true, message: 'OK', durationMs: 1 }],
    drift: { drifted: false, failedChecks: 0, totalChecks: 1, details: [] },
  });

  // Clean scheduler state for this feature
  const schedulerPath = join(ROOT, '.ogu/state/scheduler-state.json');
  if (existsSync(schedulerPath)) {
    const state = JSON.parse(readFileSync(schedulerPath, 'utf8'));
    state.queue = state.queue.filter(t => !t.taskId?.startsWith('sse-'));
    writeJSON('.ogu/state/scheduler-state.json', state);
  }
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

console.log('\n\x1b[1mSlice 10 — SSE Event Stream + Live Dashboard\x1b[0m\n');
console.log('  Real-time event streaming and system snapshot\n');

setup();

// Start daemon
console.log('\x1b[36m  Setup: Starting Kadima daemon\x1b[0m');

await test('kadima:start for SSE tests', async () => {
  const result = ogu('kadima:start');
  assertEqual(result.exitCode, 0, 'kadima:start should exit 0');
  await sleep(1500);
});

// ── Part 1: SSE Connection ──

console.log('\n\x1b[36m  Part 1: SSE Connection\x1b[0m');

await test('GET /api/events returns SSE stream', async () => {
  const controller = new AbortController();
  const resp = await fetch(`${API}/api/events`, {
    signal: controller.signal,
    headers: { 'Accept': 'text/event-stream' },
  });
  assertEqual(resp.status, 200, 'Should return 200');
  assert(
    resp.headers.get('content-type')?.includes('text/event-stream'),
    `Content-Type should be text/event-stream, got ${resp.headers.get('content-type')}`
  );
  controller.abort();
});

await test('SSE sends heartbeat/connected event', async () => {
  const events = await collectSSE('/api/events', 2000);
  assert(events.length >= 1, `Should receive at least 1 event (connected), got ${events.length}`);
  const connected = events.find(e => e.type === 'connected');
  assert(connected, 'Should receive connected event');
  assert(typeof connected.timestamp === 'string', 'Connected event should have timestamp');
});

// ── Part 2: Live Events via SSE ──

console.log('\n\x1b[36m  Part 2: Live Events via SSE\x1b[0m');

await test('SSE receives task dispatch events', async () => {
  // Start collecting SSE events
  const eventsPromise = collectSSE('/api/events', 4000);

  // Wait for SSE to connect
  await sleep(500);

  // Enqueue a task to trigger a dispatch event
  ogu('kadima:enqueue', ['--task', 'sse-task-1', '--feature', FEATURE, '--dry-run']);

  // Wait for scheduler to dispatch
  await sleep(2500);

  const events = await eventsPromise;
  const dispatches = events.filter(e => e.type === 'scheduler.dispatch' || e.type === 'task:dispatched');
  assert(dispatches.length >= 1, `Should receive dispatch event, got ${events.map(e => e.type).join(', ')}`);
});

await test('SSE receives task completion events', async () => {
  // Start collecting SSE events
  const eventsPromise = collectSSE('/api/events', 5000);

  // Wait for SSE to connect, then enqueue another task
  await sleep(500);
  ogu('kadima:enqueue', ['--task', 'sse-task-2', '--feature', FEATURE, '--dry-run']);

  // Wait for dispatch + completion
  await sleep(3500);

  const events = await eventsPromise;
  const completions = events.filter(e =>
    e.type === 'runner.completed' || e.type === 'task:completed'
  );
  assert(completions.length >= 1, `Should receive completion event, got types: ${events.map(e => e.type).join(', ')}`);
});

await test('SSE events have correct structure', async () => {
  const events = await collectSSE('/api/events', 2000);
  for (const evt of events) {
    assert(typeof evt.type === 'string', `Event should have type, got: ${JSON.stringify(evt)}`);
    assert(typeof evt.timestamp === 'string', `Event should have timestamp, got: ${JSON.stringify(evt)}`);
  }
});

// ── Part 3: Filtered SSE ──

console.log('\n\x1b[36m  Part 3: Filtered SSE\x1b[0m');

await test('GET /api/events?feature=X filters events', async () => {
  // Start filtered SSE
  const filteredPromise = collectSSE(`/api/events?feature=${FEATURE}`, 4000);

  await sleep(500);

  // Enqueue task for our feature
  ogu('kadima:enqueue', ['--task', 'sse-task-3', '--feature', FEATURE, '--dry-run']);

  await sleep(2500);
  const events = await filteredPromise;

  // All non-connected events should be for our feature
  const featureEvents = events.filter(e => e.type !== 'connected');
  for (const evt of featureEvents) {
    const matchesFeature =
      evt.payload?.featureSlug === FEATURE ||
      evt.payload?.slug === FEATURE ||
      evt.feature === FEATURE;
    assert(matchesFeature, `Event should be for ${FEATURE}, got: ${JSON.stringify(evt)}`);
  }
});

// ── Part 4: Dashboard API ──

console.log('\n\x1b[36m  Part 4: Dashboard API\x1b[0m');

await test('GET /api/dashboard returns aggregated snapshot', async () => {
  const { status, body } = await api('/api/dashboard');
  assertEqual(status, 200, 'Should return 200');
  assert(body.health, 'Should have health section');
  assert(body.features, 'Should have features section');
  assert(body.scheduler, 'Should have scheduler section');
  assert(body.budget, 'Should have budget section');
});

await test('dashboard health section has daemon info', async () => {
  const { body } = await api('/api/dashboard');
  assertEqual(body.health.status, 'healthy', 'Should be healthy');
  assert(typeof body.health.uptime === 'number', 'Should have uptime');
  assert(typeof body.health.pid === 'number', 'Should have pid');
  assert(body.health.memory, 'Should have memory');
});

await test('dashboard features section lists features', async () => {
  const { body } = await api('/api/dashboard');
  assert(Array.isArray(body.features.list), 'Should have features list');
  assert(body.features.total >= 1, `Should have at least 1 feature, got ${body.features.total}`);
  assert(body.features.byState, 'Should have byState breakdown');
});

await test('dashboard scheduler section has task counts', async () => {
  const { body } = await api('/api/dashboard');
  assert(typeof body.scheduler.totalTasks === 'number', 'Should have totalTasks');
  assert(typeof body.scheduler.completedTasks === 'number', 'Should have completedTasks');
  assert(body.scheduler.runners, 'Should have runners info');
});

await test('dashboard budget section has spending', async () => {
  const { body } = await api('/api/dashboard');
  assert(typeof body.budget.dailySpent === 'number', 'Should have dailySpent');
  assert(typeof body.budget.dailyLimit === 'number', 'Should have dailyLimit');
  assert(body.budget.byModel, 'Should have byModel');
});

await test('dashboard includes recent events', async () => {
  const { body } = await api('/api/dashboard');
  assert(Array.isArray(body.recentEvents), 'Should have recentEvents array');
  // Should have some events from our setup and task dispatches
  assert(body.recentEvents.length >= 1, `Should have recent events, got ${body.recentEvents.length}`);
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
