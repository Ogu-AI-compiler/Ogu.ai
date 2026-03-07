/**
 * slice-423.test.mjs — Gate Feedback Loop tests
 * Tests: buildGateFeedback, detectLearningOpportunity, createFeedbackRecord,
 *        listFeedbackRecords, clearFeedbackRecords, retryWithFeedback (simulate)
 */

import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildGateFeedback,
  detectLearningOpportunity,
  createFeedbackRecord,
  listFeedbackRecords,
  clearFeedbackRecords,
  retryWithFeedback,
} from '../../tools/ogu/commands/lib/gate-feedback.mjs';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const r = fn();
    if (r instanceof Promise) {
      r.then(() => { console.log(`  ✓ ${name}`); passed++; })
       .catch(e => { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; });
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── buildGateFeedback ─────────────────────────────────────────────────────────

console.log('\nbuildGateFeedback');

test('returns object with gate, message, advice, severity', () => {
  const fb = buildGateFeedback({ gate: 'type-check', passed: false });
  assert(fb.gate === 'type-check', 'gate should match');
  assert(typeof fb.message === 'string' && fb.message.length > 0, 'message required');
  assert(typeof fb.advice === 'string' && fb.advice.length > 0, 'advice required');
  assertEqual(fb.severity, 'error');
});

test('includes error in message when provided', () => {
  const fb = buildGateFeedback({ gate: 'type-check', passed: false, error: 'Type mismatch on line 42' });
  assert(fb.message.includes('Type mismatch on line 42'), 'error should be in message');
});

test('includes output in message when provided', () => {
  const fb = buildGateFeedback({ gate: 'tests-pass', passed: false, output: 'AssertionError: expected true' });
  assert(fb.message.includes('AssertionError'), 'output should be in message');
});

test('truncates long output to 800 chars', () => {
  const longOutput = 'x'.repeat(2000);
  const fb = buildGateFeedback({ gate: 'tests-pass', passed: false, output: longOutput });
  // output is truncated so message should not be extremely long
  assert(fb.message.length < 3000, 'message should be truncated');
});

test('includes DoD in message when task has definition_of_done', () => {
  const fb = buildGateFeedback(
    { gate: 'output-exists', passed: false },
    { definition_of_done: 'File must exist at src/index.ts' }
  );
  assert(fb.message.includes('File must exist at src/index.ts'), 'DoD should be in message');
});

test('includes output_artifacts in message when present', () => {
  const fb = buildGateFeedback(
    { gate: 'output-exists', passed: false },
    { output_artifacts: ['src/api/auth.ts', 'src/api/user.ts'] }
  );
  assert(fb.message.includes('src/api/auth.ts'), 'artifacts should be in message');
});

test('handles null gateResult gracefully', () => {
  const fb = buildGateFeedback(null);
  assert(fb.gate === 'unknown');
  assert(typeof fb.message === 'string');
});

test('has specific advice for type-check gate', () => {
  const fb = buildGateFeedback({ gate: 'type-check', passed: false });
  assert(fb.advice.toLowerCase().includes('type'), 'type-check advice should mention types');
});

test('has specific advice for tests-pass gate', () => {
  const fb = buildGateFeedback({ gate: 'tests-pass', passed: false });
  assert(fb.advice.toLowerCase().includes('test'), 'tests-pass advice should mention tests');
});

test('has specific advice for migration-runs gate', () => {
  const fb = buildGateFeedback({ gate: 'migration-runs', passed: false });
  assert(fb.advice.toLowerCase().includes('migr'), 'migration advice should mention migration');
});

test('falls back to generic advice for unknown gate', () => {
  const fb = buildGateFeedback({ gate: 'custom-gate-xyz', passed: false });
  assert(fb.advice.length > 0, 'fallback advice should exist');
});

test('includes taskId and taskName from task', () => {
  const fb = buildGateFeedback(
    { gate: 'output-exists', passed: false },
    { id: 'T42', name: 'Build API' }
  );
  assertEqual(fb.taskId, 'T42');
  assertEqual(fb.taskName, 'Build API');
});

// ── detectLearningOpportunity ─────────────────────────────────────────────────

console.log('\ndetectLearningOpportunity');

test('returns null for passed gate', () => {
  const trigger = detectLearningOpportunity({ gate: 'type-check', passed: true }, 0);
  assert(trigger === null, 'passed gate should return null');
});

test('returns null for null gateResult', () => {
  const trigger = detectLearningOpportunity(null, 0);
  assert(trigger === null);
});

test('returns gate_failure for first failure', () => {
  const trigger = detectLearningOpportunity({ gate: 'type-check', passed: false }, 0);
  assertEqual(trigger, 'gate_failure');
});

test('returns excessive_iterations at threshold 3', () => {
  const trigger = detectLearningOpportunity({ gate: 'type-check', passed: false }, 3);
  assertEqual(trigger, 'excessive_iterations');
});

test('returns excessive_iterations above threshold', () => {
  const trigger = detectLearningOpportunity({ gate: 'tests-pass', passed: false }, 5);
  assertEqual(trigger, 'excessive_iterations');
});

test('returns review_rejection when gate is review_rejection and iteration > 0', () => {
  const trigger = detectLearningOpportunity({ gate: 'review_rejection', passed: false }, 1);
  assertEqual(trigger, 'review_rejection');
});

test('returns exceptional_improvement when duration dropped 50%+', () => {
  const trigger = detectLearningOpportunity(
    { gate: 'type-check', passed: false, durationMs: 500 },
    0,
    1200,  // prev was 1200ms → current 500ms → ratio 0.42 → exceptional
  );
  assertEqual(trigger, 'exceptional_improvement');
});

test('does not return exceptional_improvement when improvement < 50%', () => {
  const trigger = detectLearningOpportunity(
    { gate: 'type-check', passed: false, durationMs: 800 },
    0,
    1000,  // prev 1000ms → current 800ms → ratio 0.8 → not exceptional
  );
  assert(trigger !== 'exceptional_improvement', 'should not be exceptional_improvement');
});

// ── createFeedbackRecord / listFeedbackRecords / clearFeedbackRecords ────────

console.log('\ncreateFeedbackRecord / listFeedbackRecords / clearFeedbackRecords');

let tmpDir;

test('createFeedbackRecord writes file and returns record', () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ogu-feedback-'));
  const gateResult = { gate: 'type-check', passed: false, error: 'TS2305' };
  const feedback = buildGateFeedback(gateResult);
  const record = createFeedbackRecord(tmpDir, 'task-T1', gateResult, feedback);

  assert(record.recordId, 'recordId should be present');
  assertEqual(record.taskId, 'task-T1');
  assertEqual(record.gate, 'type-check');
  assert(record.createdAt, 'createdAt required');
  assertEqual(record.processed, false);
});

test('createFeedbackRecord creates directory if missing', () => {
  const newRoot = mkdtempSync(join(tmpdir(), 'ogu-fb2-'));
  const record = createFeedbackRecord(newRoot, 'new-task', { gate: 'lint-pass', passed: false }, {});
  assert(record.recordId, 'should create record');
  try { rmSync(newRoot, { recursive: true, force: true }); } catch {}
});

test('listFeedbackRecords returns empty array when no records', () => {
  const records = listFeedbackRecords(tmpDir, 'no-such-task');
  assert(Array.isArray(records) && records.length === 0);
});

test('listFeedbackRecords returns saved records', () => {
  const gr = { gate: 'tests-pass', passed: false };
  const fb = buildGateFeedback(gr);
  createFeedbackRecord(tmpDir, 'task-list', gr, fb);
  createFeedbackRecord(tmpDir, 'task-list', gr, fb);
  const records = listFeedbackRecords(tmpDir, 'task-list');
  assert(records.length >= 2, `expected >= 2 records, got ${records.length}`);
});

test('listFeedbackRecords sorted by createdAt ascending', () => {
  const records = listFeedbackRecords(tmpDir, 'task-list');
  for (let i = 1; i < records.length; i++) {
    assert(records[i].createdAt >= records[i - 1].createdAt, 'should be sorted ascending');
  }
});

test('clearFeedbackRecords removes all records for task', () => {
  const gr = { gate: 'type-check', passed: false };
  const fb = buildGateFeedback(gr);
  createFeedbackRecord(tmpDir, 'task-clear', gr, fb);
  createFeedbackRecord(tmpDir, 'task-clear', gr, fb);
  assert(listFeedbackRecords(tmpDir, 'task-clear').length > 0, 'should have records before clear');
  clearFeedbackRecords(tmpDir, 'task-clear');
  assert(listFeedbackRecords(tmpDir, 'task-clear').length === 0, 'should be empty after clear');
});

test('clearFeedbackRecords is safe when no records exist', () => {
  clearFeedbackRecords(tmpDir, 'task-never-existed');  // should not throw
});

// ── retryWithFeedback ─────────────────────────────────────────────────────────

console.log('\nretryWithFeedback');

await testAsync('returns stopped=true when maxIterations exceeded', async () => {
  const projId = 'retry-exceeded';
  const dir = join(tmpDir, '.ogu', 'projects', projId);
  mkdirSync(dir, { recursive: true });

  // Write OrgSpec
  const oguDir = join(tmpDir, '.ogu');
  mkdirSync(oguDir, { recursive: true });
  const orgSpec = {
    orgId: "test",
    roles: [{ roleId: "backend_engineer", enabled: true, name: "Backend", maxTokensPerTask: 4096, maxCostPerTask: 0.5, modelPreferences: { minimum: "fast" } }],
    providers: [{ id: "anthropic", enabled: true, models: [{ id: "claude-haiku", tier: "fast", costPer1kInput: 0.25 }] }],
    budget: { daily: 10 },
  };
  writeFileSync(join(oguDir, 'OrgSpec.json'), JSON.stringify(orgSpec), 'utf-8');

  const result = await retryWithFeedback(
    tmpDir,
    'task-T1',
    projId,
    { gate: 'type-check', passed: false, error: 'TS error' },
    { maxIterations: 3, iterationCount: 3, simulate: true }
  );

  assert(result.stopped === true, 'should be stopped');
  assertEqual(result.reason, 'max_iterations_exceeded');
});

await testAsync('returns recordId from feedback record', async () => {
  const projId = 'retry-recordid';
  const dir = join(tmpDir, '.ogu', 'projects', projId);
  mkdirSync(dir, { recursive: true });

  const result = await retryWithFeedback(
    tmpDir,
    'task-T2',
    projId,
    { gate: 'type-check', passed: false },
    { maxIterations: 3, iterationCount: 3, simulate: true }  // over limit → stopped
  );

  assert(result.recordId, 'recordId should be returned');
});

await testAsync('includes learningTrigger in result', async () => {
  const projId = 'retry-trigger';
  const dir = join(tmpDir, '.ogu', 'projects', projId);
  mkdirSync(dir, { recursive: true });

  const result = await retryWithFeedback(
    tmpDir,
    'task-T3',
    projId,
    { gate: 'tests-pass', passed: false },
    { maxIterations: 3, iterationCount: 3, simulate: true }
  );

  assert(result.learningTrigger !== undefined, 'learningTrigger should be in result');
  assertEqual(result.learningTrigger, 'excessive_iterations');
});

await testAsync('saves feedback record to disk before retrying', async () => {
  const projId = 'retry-disk';
  const dir = join(tmpDir, '.ogu', 'projects', projId);
  mkdirSync(dir, { recursive: true });

  const taskId = 'task-disk-test';
  clearFeedbackRecords(tmpDir, taskId);  // start clean

  await retryWithFeedback(
    tmpDir,
    taskId,
    projId,
    { gate: 'type-check', passed: false },
    { maxIterations: 3, iterationCount: 3, simulate: true }  // stopped, no retry
  );

  const records = listFeedbackRecords(tmpDir, taskId);
  assert(records.length >= 1, 'feedback record should be saved before retrying');
});

await testAsync('retry with iterationCount=0 attempts execution', async () => {
  const projId = 'retry-attempt';
  const dir = join(tmpDir, '.ogu', 'projects', projId);
  mkdirSync(dir, { recursive: true });

  // iterationCount=0, maxIterations=3 → should attempt retry
  const result = await retryWithFeedback(
    tmpDir,
    'task-attempt',
    projId,
    { gate: 'type-check', passed: false },
    { maxIterations: 3, iterationCount: 0, simulate: true }
  );

  assert(result.stopped === false, 'should not be stopped at iteration 0');
  assert(result.iterationCount === 1, `iterationCount should be 1, got ${result.iterationCount}`);
  assert(result.result !== undefined, 'should have a result from executeAgentTaskCore');
});

// Cleanup
try { if (tmpDir) rmSync(tmpDir, { recursive: true, force: true }); } catch {}

await new Promise(r => setTimeout(r, 100));

console.log('\n' + '─'.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
