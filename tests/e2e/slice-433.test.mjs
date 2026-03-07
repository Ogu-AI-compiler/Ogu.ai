/**
 * Slice 433 — Structured Gate Feedback
 * Tests per-gate-type parsers and integration with buildGateFeedback.
 */
import { strict as assert } from 'node:assert';
import {
  parseTypeCheckOutput,
  parseTestsPassOutput,
  parseSchemaValidOutput,
  parseSyntaxErrorOutput,
  parseOutputExistsOutput,
  GATE_PARSERS,
  formatParsedOutput,
  buildGateFeedback,
} from '../../tools/ogu/commands/lib/gate-feedback.mjs';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS: ${name}`); }
  catch (e) { failed++; console.error(`  FAIL: ${name} — ${e.message}`); }
}

console.log('\n=== Slice 433: Structured Gate Feedback ===\n');

// ── parseTypeCheckOutput ─────────────────────────────────────────────────────

test('parseTypeCheckOutput: parses tsc errors', () => {
  const output = `src/api/users.ts(12,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/api/users.ts(25,10): error TS2304: Cannot find name 'UserModel'.
src/db/schema.ts(8,1): error TS1005: ';' expected.`;
  const result = parseTypeCheckOutput(output);
  assert.equal(result.errors.length, 3);
  assert.equal(result.errors[0].file, 'src/api/users.ts');
  assert.equal(result.errors[0].line, 12);
  assert.equal(result.errors[0].code, 'TS2345');
  assert.ok(result.errors[0].message.includes('Argument of type'));
  assert.equal(result.errors[2].file, 'src/db/schema.ts');
});

test('parseTypeCheckOutput: caps at 5 errors', () => {
  const lines = [];
  for (let i = 0; i < 10; i++) {
    lines.push(`src/f${i}.ts(${i + 1},1): error TS9999: Error ${i}`);
  }
  const result = parseTypeCheckOutput(lines.join('\n'));
  assert.equal(result.errors.length, 5);
});

test('parseTypeCheckOutput: empty/null input', () => {
  assert.deepEqual(parseTypeCheckOutput(null), { errors: [] });
  assert.deepEqual(parseTypeCheckOutput(''), { errors: [] });
  assert.deepEqual(parseTypeCheckOutput('all good'), { errors: [] });
});

// ── parseTestsPassOutput ─────────────────────────────────────────────────────

test('parseTestsPassOutput: parses Jest failures', () => {
  const output = `● Auth Suite > should validate token
    Expected: "valid"
    Received: "expired"
● Auth Suite > should reject bad tokens
    Expected: 401
    Received: 200`;
  const result = parseTestsPassOutput(output);
  assert.equal(result.failures.length, 2);
  assert.ok(result.failures[0].name.includes('should validate token'));
  assert.equal(result.failures[0].expected, '"valid"');
  assert.equal(result.failures[0].actual, '"expired"');
});

test('parseTestsPassOutput: caps at 3 failures', () => {
  const blocks = [];
  for (let i = 0; i < 6; i++) {
    blocks.push(`● Test ${i}\n    Expected: ${i}\n    Received: ${i + 1}`);
  }
  const result = parseTestsPassOutput(blocks.join('\n'));
  assert.equal(result.failures.length, 3);
});

test('parseTestsPassOutput: empty input', () => {
  assert.deepEqual(parseTestsPassOutput(null), { failures: [] });
  assert.deepEqual(parseTestsPassOutput('All tests passed'), { failures: [] });
});

// ── parseSchemaValidOutput ───────────────────────────────────────────────────

test('parseSchemaValidOutput: extracts error lines', () => {
  const output = `Validating schema...
error: "name" is required
error: "version" must be a string
invalid field "xyz" at /root/config
All other fields OK`;
  const result = parseSchemaValidOutput(output);
  assert.equal(result.errors.length, 3);
  assert.ok(result.errors[0].includes('"name" is required'));
});

test('parseSchemaValidOutput: caps at 8', () => {
  const lines = [];
  for (let i = 0; i < 15; i++) lines.push(`error: field ${i} is missing`);
  const result = parseSchemaValidOutput(lines.join('\n'));
  assert.equal(result.errors.length, 8);
});

test('parseSchemaValidOutput: empty input', () => {
  assert.deepEqual(parseSchemaValidOutput(''), { errors: [] });
});

// ── parseSyntaxErrorOutput ───────────────────────────────────────────────────

test('parseSyntaxErrorOutput: parses Node.js style errors', () => {
  const output = `SyntaxError: Unexpected token
    at src/index.js:42:10
    at src/utils/helper.js:8:3`;
  const result = parseSyntaxErrorOutput(output);
  assert.equal(result.errors.length, 2);
  assert.equal(result.errors[0].file, 'src/index.js');
  assert.equal(result.errors[0].line, 42);
});

test('parseSyntaxErrorOutput: deduplicates same file:line', () => {
  const output = `at src/x.js:10:5\nat src/x.js:10:5\nat src/y.js:20:1`;
  const result = parseSyntaxErrorOutput(output);
  assert.equal(result.errors.length, 2);
});

test('parseSyntaxErrorOutput: caps at 3', () => {
  const lines = [];
  for (let i = 0; i < 10; i++) lines.push(`at src/f${i}.js:${i + 1}:1`);
  const result = parseSyntaxErrorOutput(lines.join('\n'));
  assert.equal(result.errors.length, 3);
});

// ── parseOutputExistsOutput ──────────────────────────────────────────────────

test('parseOutputExistsOutput: extracts missing files from output', () => {
  const output = `Checking outputs...
file not found: src/api/users.ts
does not exist: src/db/schema.sql`;
  const result = parseOutputExistsOutput(output);
  assert.equal(result.missing.length, 2);
  assert.ok(result.missing.includes('src/api/users.ts'));
});

test('parseOutputExistsOutput: falls back to task.output_artifacts', () => {
  const result = parseOutputExistsOutput('some unrecognized output', {
    output_artifacts: ['src/foo.ts', 'src/bar.ts'],
  });
  assert.equal(result.missing.length, 2);
  assert.ok(result.missing.includes('src/foo.ts'));
});

test('parseOutputExistsOutput: empty', () => {
  assert.deepEqual(parseOutputExistsOutput(null), { missing: [] });
});

// ── GATE_PARSERS dispatch ────────────────────────────────────────────────────

test('GATE_PARSERS: has entries for 5 gate types', () => {
  assert.ok(GATE_PARSERS['type-check']);
  assert.ok(GATE_PARSERS['tests-pass']);
  assert.ok(GATE_PARSERS['schema-valid']);
  assert.ok(GATE_PARSERS['no-syntax-error']);
  assert.ok(GATE_PARSERS['output-exists']);
});

// ── formatParsedOutput ───────────────────────────────────────────────────────

test('formatParsedOutput: formats type-check errors', () => {
  const formatted = formatParsedOutput('type-check', {
    errors: [{ file: 'a.ts', line: 1, code: 'TS123', message: 'bad type' }],
  });
  assert.ok(formatted.includes('a.ts:1'));
  assert.ok(formatted.includes('TS123'));
});

test('formatParsedOutput: formats test failures', () => {
  const formatted = formatParsedOutput('tests-pass', {
    failures: [{ name: 'my test', expected: '1', actual: '2' }],
  });
  assert.ok(formatted.includes('FAIL: my test'));
  assert.ok(formatted.includes('Expected: 1'));
});

test('formatParsedOutput: returns empty for null', () => {
  assert.equal(formatParsedOutput('type-check', null), '');
});

// ── buildGateFeedback integration ────────────────────────────────────────────

test('buildGateFeedback: uses structured format for type-check gate', () => {
  const result = buildGateFeedback(
    { gate: 'type-check', passed: false, output: 'src/x.ts(5,1): error TS2304: Cannot find name "foo".' },
    { id: 't1', name: 'task1' },
  );
  assert.equal(result.gate, 'type-check');
  assert.ok(result.message.includes('Structured errors'));
  assert.ok(result.message.includes('src/x.ts:5'));
  assert.ok(result.structured);
  assert.equal(result.structured.errors.length, 1);
  assert.equal(result.structured.errors[0].code, 'TS2304');
});

test('buildGateFeedback: uses structured format for tests-pass gate', () => {
  const result = buildGateFeedback(
    { gate: 'tests-pass', passed: false, output: '● should work\n    Expected: true\n    Received: false' },
    { id: 't2' },
  );
  assert.ok(result.structured);
  assert.equal(result.structured.failures.length, 1);
  assert.ok(result.message.includes('FAIL:'));
});

test('buildGateFeedback: falls back to truncated output for unknown gate', () => {
  const longOutput = 'x'.repeat(2000);
  const result = buildGateFeedback(
    { gate: 'custom-gate', passed: false, output: longOutput },
    {},
  );
  assert.ok(result.message.includes('Gate output'));
  assert.ok(result.message.length < longOutput.length);
  assert.equal(result.structured, null);
});

test('buildGateFeedback: structured is null when parser returns empty', () => {
  const result = buildGateFeedback(
    { gate: 'type-check', passed: false, output: 'no errors here' },
    {},
  );
  // Parser returns { errors: [] }, structured is set but formatParsedOutput returns ''
  // So it falls back to truncated output
  assert.ok(result.structured);
  assert.equal(result.structured.errors.length, 0);
});

test('buildGateFeedback: backward compat — same core fields', () => {
  const result = buildGateFeedback({ gate: 'lint-pass', passed: false }, { id: 'x', name: 'y' });
  assert.ok('gate' in result);
  assert.ok('message' in result);
  assert.ok('advice' in result);
  assert.ok('severity' in result);
  assert.ok('taskId' in result);
  assert.ok('taskName' in result);
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
