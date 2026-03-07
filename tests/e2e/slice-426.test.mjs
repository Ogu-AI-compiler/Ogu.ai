/**
 * slice-426.test.mjs — Execution Metrics tests
 * Tests: recordTaskMetric, aggregateMetrics, saveMetrics, loadMetrics, formatMetricsReport
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  recordTaskMetric,
  aggregateMetrics,
  saveMetrics,
  loadMetrics,
  formatMetricsReport,
} from '../../tools/ogu/commands/lib/execution-metrics.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assertClose(a, b, eps = 0.0001, msg) {
  if (Math.abs(a - b) > eps) throw new Error(msg || `expected ${b} ≈ ${a}`);
}

// ── saveMetrics / loadMetrics ─────────────────────────────────────────────────

console.log('\nsaveMetrics / loadMetrics');

let tmpDir;

test('saveMetrics creates metrics.json file', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-metrics-'));
  const data = { tasks: {}, aggregates: null };
  saveMetrics(tmpDir, 'proj-save', data);
  const loaded = loadMetrics(tmpDir, 'proj-save');
  assert(loaded !== null, 'metrics should be loadable');
});

test('loadMetrics returns null for missing project', () => {
  const result = loadMetrics(tmpDir, 'proj-nonexistent');
  assert(result === null);
});

test('saveMetrics creates directory if missing', () => {
  const data = { tasks: {}, note: 'test' };
  saveMetrics(tmpDir, 'proj-newdir', data);
  const loaded = loadMetrics(tmpDir, 'proj-newdir');
  assert(loaded !== null);
  assertEqual(loaded.note, 'test');
});

test('loadMetrics round-trips data correctly', () => {
  const data = {
    tasks: {
      T1: { taskId: 'T1', success: true, cost: 0.05 },
    },
    aggregates: null,
  };
  saveMetrics(tmpDir, 'proj-rt', data);
  const loaded = loadMetrics(tmpDir, 'proj-rt');
  assert(loaded.tasks.T1.taskId === 'T1');
  assertClose(loaded.tasks.T1.cost, 0.05);
});

// ── recordTaskMetric ──────────────────────────────────────────────────────────

console.log('\nrecordTaskMetric');

test('records a task metric and loadable', () => {
  recordTaskMetric(tmpDir, 'proj-rec', {
    taskId: 'T1',
    success: true,
    status: 'completed',
    durationMs: 1200,
    cost: 0.03,
    ownerRole: 'backend_engineer',
  });
  const data = loadMetrics(tmpDir, 'proj-rec');
  assert(data !== null);
  assert(data.tasks['T1'] !== undefined, 'T1 should be recorded');
  assertEqual(data.tasks['T1'].taskId, 'T1');
  assertEqual(data.tasks['T1'].success, true);
});

test('recordedAt is added automatically', () => {
  recordTaskMetric(tmpDir, 'proj-ts', { taskId: 'T2', success: false, status: 'failed' });
  const data = loadMetrics(tmpDir, 'proj-ts');
  assert(data.tasks['T2'].recordedAt !== undefined, 'recordedAt should be set');
  assert(!isNaN(new Date(data.tasks['T2'].recordedAt).getTime()), 'recordedAt should be valid ISO');
});

test('multiple metrics are accumulated', () => {
  recordTaskMetric(tmpDir, 'proj-multi', { taskId: 'A', success: true, cost: 0.01 });
  recordTaskMetric(tmpDir, 'proj-multi', { taskId: 'B', success: false, cost: 0.02 });
  recordTaskMetric(tmpDir, 'proj-multi', { taskId: 'C', success: true, cost: 0.03 });
  const data = loadMetrics(tmpDir, 'proj-multi');
  assert(Object.keys(data.tasks).length === 3, 'should have 3 tasks');
});

test('later recording overwrites earlier for same taskId', () => {
  recordTaskMetric(tmpDir, 'proj-overwrite', { taskId: 'X', success: false, cost: 0.01 });
  recordTaskMetric(tmpDir, 'proj-overwrite', { taskId: 'X', success: true, cost: 0.05 });
  const data = loadMetrics(tmpDir, 'proj-overwrite');
  assertEqual(data.tasks['X'].success, true, 'should use latest value');
  assertClose(data.tasks['X'].cost, 0.05);
});

test('no-op for metric without taskId', () => {
  recordTaskMetric(tmpDir, 'proj-noid', { success: true });  // should not throw
});

// ── aggregateMetrics ──────────────────────────────────────────────────────────

console.log('\naggregateMetrics');

test('returns null for missing project', () => {
  const result = aggregateMetrics(tmpDir, 'proj-never');
  assert(result === null);
});

test('computes total and success counts', () => {
  recordTaskMetric(tmpDir, 'proj-agg', { taskId: 'T1', success: true, cost: 0.01, durationMs: 500, ownerRole: 'backend_engineer' });
  recordTaskMetric(tmpDir, 'proj-agg', { taskId: 'T2', success: false, cost: 0.02, durationMs: 300, ownerRole: 'qa' });
  recordTaskMetric(tmpDir, 'proj-agg', { taskId: 'T3', success: true, cost: 0.015, durationMs: 400, ownerRole: 'backend_engineer' });

  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  assert(agg !== null, 'aggregates should be computed');
  assertEqual(agg.total, 3);
  assertEqual(agg.completed, 2);
  assertEqual(agg.failed, 1);
});

test('successRate is correct', () => {
  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  assertClose(agg.successRate, 2 / 3, 0.001, 'successRate should be 2/3');
});

test('totalCostUSD is sum of task costs', () => {
  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  assertClose(agg.totalCostUSD, 0.01 + 0.02 + 0.015, 0.0001, 'total cost should match');
});

test('avgDurationMs is correct', () => {
  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  const expected = Math.round((500 + 300 + 400) / 3);
  assertEqual(agg.avgDurationMs, expected, `avgDurationMs should be ${expected}`);
});

test('agentTaskCounts groups by ownerRole when no ownerAgentId', () => {
  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  assert(agg.agentTaskCounts !== undefined, 'agentTaskCounts should exist');
  assert(agg.agentTaskCounts['backend_engineer'] === 2, 'backend_engineer should have 2 tasks');
  assert(agg.agentTaskCounts['qa'] === 1, 'qa should have 1 task');
});

test('gatePassRate computed from gateResult field', () => {
  recordTaskMetric(tmpDir, 'proj-gate', { taskId: 'G1', success: true, gateResult: true, cost: 0.01, durationMs: 100 });
  recordTaskMetric(tmpDir, 'proj-gate', { taskId: 'G2', success: false, gateResult: false, cost: 0.01, durationMs: 100 });
  recordTaskMetric(tmpDir, 'proj-gate', { taskId: 'G3', success: true, gateResult: true, cost: 0.01, durationMs: 100 });

  const agg = aggregateMetrics(tmpDir, 'proj-gate');
  assert(agg.gatePassRate !== null, 'gatePassRate should not be null');
  assertClose(agg.gatePassRate, 2 / 3, 0.001, 'gatePassRate should be 2/3');
});

test('gatePassRate is null when no gateResult fields', () => {
  recordTaskMetric(tmpDir, 'proj-nogate', { taskId: 'X', success: true, cost: 0.01, durationMs: 100 });
  const agg = aggregateMetrics(tmpDir, 'proj-nogate');
  assert(agg.gatePassRate === null, 'gatePassRate should be null when no gateResult data');
});

test('aggregates saved back to metrics.json', () => {
  aggregateMetrics(tmpDir, 'proj-agg');
  const data = loadMetrics(tmpDir, 'proj-agg');
  assert(data.aggregates !== null, 'aggregates should be saved');
  assert(data.aggregates.total === 3, 'saved aggregates should have total');
});

test('computedAt is valid ISO timestamp', () => {
  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  assert(!isNaN(new Date(agg.computedAt).getTime()), 'computedAt should be valid ISO');
});

// ── formatMetricsReport ───────────────────────────────────────────────────────

console.log('\nformatMetricsReport');

test('returns non-empty string', () => {
  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  const report = formatMetricsReport(agg);
  assert(typeof report === 'string' && report.length > 0);
});

test('contains project id', () => {
  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  const report = formatMetricsReport(agg);
  assert(report.includes('proj-agg'), 'report should contain projectId');
});

test('contains task count', () => {
  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  const report = formatMetricsReport(agg);
  assert(report.includes('3'), 'report should mention task count');
});

test('contains cost', () => {
  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  const report = formatMetricsReport(agg);
  assert(report.toLowerCase().includes('cost') || report.includes('$'), 'report should mention cost');
});

test('handles null metrics gracefully', () => {
  const report = formatMetricsReport(null);
  assert(typeof report === 'string');
  assert(report.length > 0);
});

test('contains success rate or percentage', () => {
  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  const report = formatMetricsReport(agg);
  assert(report.includes('%') || report.toLowerCase().includes('success'), 'report should mention success rate');
});

test('contains agent distribution', () => {
  const agg = aggregateMetrics(tmpDir, 'proj-agg');
  const report = formatMetricsReport(agg);
  assert(report.includes('backend_engineer') || report.toLowerCase().includes('agent'), 'report should mention agents');
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
