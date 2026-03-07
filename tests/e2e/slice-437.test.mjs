/**
 * Slice 437 — Studio Execution Monitor Screen
 * Tests component structure, API integration, and route registration.
 */
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); }
}

console.log('\n=== Slice 437: Studio Execution Monitor ===\n');

const ROOT = process.cwd();

// ── ExecutionMonitor component exists ────────────────────────────────────────

test('ExecutionMonitor.tsx exists', () => {
  assert.ok(existsSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx')));
});

test('ExecutionMonitor exports ExecutionMonitor component', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  assert.ok(src.includes('export function ExecutionMonitor'));
});

// ── Three core UI sections ───────────────────────────────────────────────────

test('ExecutionMonitor has timeline section (TimelineRow)', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  assert.ok(src.includes('TimelineRow'));
  assert.ok(src.includes('formatTime'));
});

test('ExecutionMonitor has agent status section (AgentCard)', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  assert.ok(src.includes('AgentCard'));
  assert.ok(src.includes('agent.status'));
  assert.ok(src.includes('agent.currentTask'));
});

test('ExecutionMonitor has task status grid', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  assert.ok(src.includes('TaskStatusGrid'));
  assert.ok(src.includes('"running"'));
  assert.ok(src.includes('"passed"'));
  assert.ok(src.includes('"failed"'));
  assert.ok(src.includes('"retrying"'));
});

// ── Filters ──────────────────────────────────────────────────────────────────

test('ExecutionMonitor has event category filters', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  assert.ok(src.includes('EVENT_CATEGORIES'));
  assert.ok(src.includes('"Tasks"'));
  assert.ok(src.includes('"Gates"'));
  assert.ok(src.includes('"Retries"'));
  assert.ok(src.includes('"Compile"'));
  assert.ok(src.includes('"Learning"'));
});

test('ExecutionMonitor has taskId filter input', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  assert.ok(src.includes('taskFilter'));
  assert.ok(src.includes('Filter by taskId'));
});

// ── Event type colors ────────────────────────────────────────────────────────

test('TYPE_COLORS covers all 14 event types', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  const types = [
    'task.started', 'task.completed', 'task.failed',
    'gate.checking', 'gate.passed', 'gate.failed',
    'retry.started', 'retry.exhausted',
    'compile.started', 'compile.gate', 'compile.finished',
    'escalation.triggered', 'feedback.created', 'learning.candidate',
  ];
  for (const type of types) {
    assert.ok(src.includes(`"${type}"`), `Missing color for ${type}`);
  }
});

// ── API integration ──────────────────────────────────────────────────────────

test('ExecutionMonitor calls api.getExecutionFeed', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  assert.ok(src.includes('api.getExecutionFeed'));
});

test('ExecutionMonitor calls api.getExecutionStats', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  assert.ok(src.includes('api.getExecutionStats'));
});

// ── Live update via WS ──────────────────────────────────────────────────────

test('ExecutionMonitor subscribes to execution WS events', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  assert.ok(src.includes('execution:task.started'));
  assert.ok(src.includes('execution:task.completed'));
  assert.ok(src.includes('execution:gate.failed'));
});

test('ExecutionMonitor uses useSocket hook', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  assert.ok(src.includes('useSocket'));
});

// ── Route registration ───────────────────────────────────────────────────────

test('MainArea routes /execution to ExecutionMonitor', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/layout/MainArea.tsx'), 'utf8');
  assert.ok(src.includes('"/execution"'));
  assert.ok(src.includes('ExecutionMonitor'));
});

test('MainArea imports ExecutionMonitor', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/layout/MainArea.tsx'), 'utf8');
  assert.ok(src.includes('import { ExecutionMonitor }'));
});

// ── API client has execution methods ──────────────────────────────────────────

test('api.ts has getExecutionFeed', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/lib/api.ts'), 'utf8');
  assert.ok(src.includes('getExecutionFeed'));
});

test('api.ts has getExecutionStats', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/lib/api.ts'), 'utf8');
  assert.ok(src.includes('getExecutionStats'));
});

test('api.ts has getExecutionEventTypes', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/lib/api.ts'), 'utf8');
  assert.ok(src.includes('getExecutionEventTypes'));
});

// ── Auto-refresh interval ────────────────────────────────────────────────────

test('ExecutionMonitor auto-refreshes every 5s', () => {
  const src = readFileSync(join(ROOT, 'tools/studio/src/components/kadima/ExecutionMonitor.tsx'), 'utf8');
  assert.ok(src.includes('setInterval'));
  assert.ok(src.includes('5000'));
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
