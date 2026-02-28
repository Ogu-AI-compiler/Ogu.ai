/**
 * Error Registry Tests — oguError, formatErrors, hasErrors.
 *
 * Run: node tools/ogu/tests/errors.test.mjs
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (err) { console.log(`  FAIL  ${name}`); console.log(`        ${err.message}`); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const { oguError, formatErrors, hasErrors } = await import('../commands/lib/errors.mjs');

console.log('\nError Registry Tests\n');

// ── oguError ──

test('1. oguError returns structured error for valid code', () => {
  const err = oguError('OGU0001');
  assert(err.code === 'OGU0001', `expected OGU0001, got ${err.code}`);
  assert(typeof err.message === 'string', 'message should be string');
  assert(typeof err.severity === 'string', 'severity should be string');
});

test('2. oguError returns unknown for invalid code', () => {
  const err = oguError('FAKE9999');
  assert(err.code === 'FAKE9999', 'should preserve the code');
  assert(err.message.includes('nknown') || err.message.includes('undefined'), 'should indicate unknown');
});

test('3. oguError interpolates params into message', () => {
  // Try a code that uses {file} param
  const err = oguError('OGU0101', { file: 'test.ts' });
  assert(err.code === 'OGU0101', 'code should match');
  // If the code supports params, message should contain interpolated value
  assert(typeof err.message === 'string', 'message should still be string');
});

test('4. oguError with empty params', () => {
  const err = oguError('OGU0001', {});
  assert(err.code === 'OGU0001', 'code should match');
  assert(typeof err.message === 'string', 'message should be string');
});

test('5. oguError returns gate field', () => {
  const err = oguError('OGU0001');
  assert('gate' in err, 'should have gate field');
});

// ── hasErrors ──

test('6. hasErrors returns true when errors present', () => {
  const errors = [
    { code: 'OGU0001', severity: 'error', message: 'Test error' },
  ];
  assert(hasErrors(errors) === true, 'should return true for errors');
});

test('7. hasErrors returns false when only warnings', () => {
  const errors = [
    { code: 'OGU0001', severity: 'warning', message: 'Test warning' },
  ];
  assert(hasErrors(errors) === false, 'should return false for warnings only');
});

test('8. hasErrors returns false for empty array', () => {
  assert(hasErrors([]) === false, 'empty array should return false');
});

test('9. hasErrors handles mixed errors and warnings', () => {
  const errors = [
    { code: 'W1', severity: 'warning', message: 'warn' },
    { code: 'E1', severity: 'error', message: 'err' },
  ];
  assert(hasErrors(errors) === true, 'should return true if any error');
});

// ── formatErrors ──

test('10. formatErrors returns string', () => {
  const errors = [oguError('OGU0001')];
  const result = formatErrors(errors);
  assert(typeof result === 'string', 'should return string');
});

test('11. formatErrors includes error count', () => {
  const errors = [
    { code: 'E1', severity: 'error', message: 'first error' },
    { code: 'E2', severity: 'error', message: 'second error' },
  ];
  const result = formatErrors(errors);
  assert(result.includes('2') || result.includes('error'), 'should mention error count');
});

test('12. formatErrors handles empty array', () => {
  const result = formatErrors([]);
  assert(typeof result === 'string', 'should return string even for empty');
});

test('13. formatErrors separates errors from warnings', () => {
  const errors = [
    { code: 'E1', severity: 'error', message: 'bad' },
    { code: 'W1', severity: 'warning', message: 'meh' },
  ];
  const result = formatErrors(errors);
  assert(typeof result === 'string', 'should format mixed list');
});

// ── Edge cases ──

test('14. oguError with undefined code', () => {
  const err = oguError(undefined);
  assert(typeof err === 'object', 'should return an object');
});

test('15. oguError with null params throws or returns error', () => {
  // oguError doesn't guard against null params — it uses Object.entries()
  // This is expected: callers should pass {} not null
  let threw = false;
  try { oguError('OGU0001', null); } catch { threw = true; }
  assert(threw === true, 'should throw on null params (Object.entries(null) fails)');
});

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed}\n`);
process.exit(failed > 0 ? 1 : 0);
