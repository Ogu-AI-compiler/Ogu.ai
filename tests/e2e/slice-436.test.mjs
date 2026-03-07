/**
 * Slice 436 — Gate Feedback → Learning Pipeline
 * Tests the bridge from structured gate feedback to learning candidates.
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractContextSignature,
  extractFailureSignals,
  buildResolutionSummary,
  buildLearningFromGateFeedback,
  processGateResolution,
} from '../../tools/ogu/commands/lib/gate-learning-bridge.mjs';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); }
}

console.log('\n=== Slice 436: Gate Feedback → Learning Pipeline ===\n');

const TMP = join(process.cwd(), '.tmp-test-436');
function setup() { rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true }); }
function cleanup() { rmSync(TMP, { recursive: true, force: true }); }

// ── extractContextSignature ──────────────────────────────────────────────────

test('extractContextSignature: type-check with TS codes', () => {
  const tags = extractContextSignature(
    { errors: [{ file: 'src/api.ts', line: 5, code: 'TS2304', message: 'not found' }, { file: 'src/api.ts', line: 10, code: 'TS2345', message: 'bad type' }] },
    'type-check',
  );
  assert.ok(tags.includes('gate:type-check'));
  assert.ok(tags.includes('ts:TS2304'));
  assert.ok(tags.includes('ts:TS2345'));
  assert.ok(tags.includes('ext:ts'));
});

test('extractContextSignature: tests-pass with suite names', () => {
  const tags = extractContextSignature(
    { failures: [{ name: 'Auth Suite > should validate', expected: 'true', actual: 'false' }] },
    'tests-pass',
  );
  assert.ok(tags.includes('gate:tests-pass'));
  assert.ok(tags.includes('test-failures:1'));
  assert.ok(tags.some(t => t.startsWith('suite:')));
});

test('extractContextSignature: null structured returns gate tag only', () => {
  const tags = extractContextSignature(null, 'lint-pass');
  assert.deepEqual(tags, ['gate:lint-pass']);
});

test('extractContextSignature: output-exists with missing count', () => {
  const tags = extractContextSignature(
    { missing: ['src/api.ts', 'src/types.ts'] },
    'output-exists',
  );
  assert.ok(tags.includes('missing-files:2'));
});

test('extractContextSignature: schema-valid with error count', () => {
  const tags = extractContextSignature(
    { errors: ['field x required', 'field y invalid'] },
    'schema-valid',
  );
  assert.ok(tags.includes('schema-errors:2'));
});

// ── extractFailureSignals ────────────────────────────────────────────────────

test('extractFailureSignals: type-check extracts error codes', () => {
  const signals = extractFailureSignals(
    { errors: [{ code: 'TS2304', message: 'Cannot find name "Foo"' }] },
    'type-check',
  );
  assert.equal(signals.length, 1);
  assert.ok(signals[0].includes('TS2304'));
  assert.ok(signals[0].includes('Cannot find name'));
});

test('extractFailureSignals: tests-pass extracts test names with expected/actual', () => {
  const signals = extractFailureSignals(
    { failures: [{ name: 'should work', expected: '1', actual: '2' }] },
    'tests-pass',
  );
  assert.equal(signals.length, 1);
  assert.ok(signals[0].includes('FAIL:'));
  assert.ok(signals[0].includes('expected=1'));
});

test('extractFailureSignals: null structured returns gate-unknown', () => {
  const signals = extractFailureSignals(null, 'build-pass');
  assert.deepEqual(signals, ['build-pass-unknown']);
});

test('extractFailureSignals: syntax errors reference file:line', () => {
  const signals = extractFailureSignals(
    { errors: [{ file: 'src/x.js', line: 42 }] },
    'no-syntax-error',
  );
  assert.ok(signals[0].includes('src/x.js:42'));
});

test('extractFailureSignals: caps at 3 signals', () => {
  const signals = extractFailureSignals(
    { errors: Array.from({ length: 10 }, (_, i) => ({ code: `TS${i}`, message: `err ${i}` })) },
    'type-check',
  );
  assert.equal(signals.length, 3);
});

// ── buildResolutionSummary ───────────────────────────────────────────────────

test('buildResolutionSummary: type-check includes TS codes', () => {
  const summary = buildResolutionSummary('type-check',
    { errors: [{ code: 'TS2304', message: 'x' }, { code: 'TS2345', message: 'y' }] },
    2,
  );
  assert.ok(summary.includes('2 iteration'));
  assert.ok(summary.includes('TS2304'));
  assert.ok(summary.includes('TS2345'));
});

test('buildResolutionSummary: tests-pass includes failure count', () => {
  const summary = buildResolutionSummary('tests-pass',
    { failures: [{ name: 'a' }, { name: 'b' }] },
    1,
  );
  assert.ok(summary.includes('2 failing test'));
});

test('buildResolutionSummary: output-exists includes missing count', () => {
  const summary = buildResolutionSummary('output-exists',
    { missing: ['a.ts', 'b.ts', 'c.ts'] },
    1,
  );
  assert.ok(summary.includes('3 missing output file'));
});

// ── buildLearningFromGateFeedback ────────────────────────────────────────────

test('buildLearningFromGateFeedback: full integration', () => {
  const result = buildLearningFromGateFeedback(
    {
      gate: 'type-check',
      passed: false,
      structured: { errors: [{ file: 'src/api.ts', line: 5, code: 'TS2304', message: 'Cannot find name "Foo"' }] },
    },
    { iterationCount: 2, success: true },
    { owner_agent_id: 'agent-123', owner_role: 'backend_engineer', name: 'build-api' },
  );

  assert.equal(result.agentId, 'agent-123');
  assert.equal(result.taskType, 'backend_engineer');
  assert.ok(result.contextSignature.includes('gate:type-check'));
  assert.ok(result.contextSignature.includes('ts:TS2304'));
  assert.ok(result.failureSignals[0].includes('TS2304'));
  assert.ok(result.resolutionSummary.includes('2 iteration'));
  assert.equal(result.iterationCount, 2);
  assert.equal(result.trigger, 'gate_failure');
});

test('buildLearningFromGateFeedback: excessive iterations trigger', () => {
  const result = buildLearningFromGateFeedback(
    { gate: 'tests-pass', structured: { failures: [{ name: 'x' }] } },
    { iterationCount: 3 },
    { owner_agent_id: 'a1', owner_role: 'qa' },
  );
  assert.equal(result.trigger, 'excessive_iterations');
});

test('buildLearningFromGateFeedback: null agent returns null agentId', () => {
  const result = buildLearningFromGateFeedback(
    { gate: 'type-check', structured: null },
    {},
    {},
  );
  assert.equal(result.agentId, null);
});

// ── processGateResolution ────────────────────────────────────────────────────

test('processGateResolution: creates candidate for resolved gate failure', () => {
  setup();
  const candidate = processGateResolution(TMP, {
    gateResult: {
      gate: 'type-check',
      passed: false,
      structured: { errors: [{ file: 'a.ts', line: 1, code: 'TS2304', message: 'x' }] },
    },
    resolution: { iterationCount: 2, success: true },
    taskSpec: { owner_agent_id: 'agent-1', owner_role: 'backend', name: 'task-1' },
  });

  assert.ok(candidate);
  assert.ok(candidate.event_id);
  assert.equal(candidate.agent_id, 'agent-1');
  assert.equal(candidate.status, 'pending');
  assert.ok(candidate.context_signature.includes('gate:type-check'));

  // Verify file was written
  const dir = join(TMP, '.ogu/marketplace/learning-candidates');
  assert.ok(existsSync(dir));
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  assert.equal(files.length, 1);
  cleanup();
});

test('processGateResolution: returns null if not resolved (success=false)', () => {
  setup();
  const result = processGateResolution(TMP, {
    gateResult: { gate: 'type-check', structured: { errors: [] } },
    resolution: { iterationCount: 1, success: false },
    taskSpec: { owner_agent_id: 'a1' },
  });
  assert.equal(result, null);
  cleanup();
});

test('processGateResolution: returns null if no structured data', () => {
  setup();
  const result = processGateResolution(TMP, {
    gateResult: { gate: 'type-check', structured: null },
    resolution: { iterationCount: 2, success: true },
    taskSpec: { owner_agent_id: 'a1' },
  });
  assert.equal(result, null);
  cleanup();
});

test('processGateResolution: returns null if no agent', () => {
  setup();
  const result = processGateResolution(TMP, {
    gateResult: { gate: 'type-check', structured: { errors: [{ code: 'TS1', message: 'x' }] } },
    resolution: { iterationCount: 2, success: true },
    taskSpec: { owner_agent_id: null },
  });
  assert.equal(result, null);
  cleanup();
});

test('processGateResolution: respects minIterations', () => {
  setup();
  const result = processGateResolution(TMP, {
    gateResult: { gate: 'type-check', structured: { errors: [{ code: 'TS1', message: 'x' }] } },
    resolution: { iterationCount: 1, success: true },
    taskSpec: { owner_agent_id: 'a1' },
    minIterations: 2,
  });
  assert.equal(result, null);
  cleanup();
});

test('processGateResolution: iterationCount=1 works with minIterations=1 (default)', () => {
  setup();
  const result = processGateResolution(TMP, {
    gateResult: { gate: 'tests-pass', structured: { failures: [{ name: 'test1' }] } },
    resolution: { iterationCount: 1, success: true },
    taskSpec: { owner_agent_id: 'a1', owner_role: 'qa' },
  });
  assert.ok(result);
  assert.equal(result.agent_id, 'a1');
  cleanup();
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
cleanup();
process.exit(failed > 0 ? 1 : 0);
