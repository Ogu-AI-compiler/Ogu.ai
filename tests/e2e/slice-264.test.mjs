import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 264 — Retry Handler + Backoff Strategy\x1b[0m\n');

console.log('\x1b[36m  Part 1: Retry Handler\x1b[0m');
test('retry-handler.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/retry-handler.mjs'));
});

const { createRetryHandler } = await import('../../tools/ogu/commands/lib/retry-handler.mjs');

test('succeeds on first try', () => {
  const rh = createRetryHandler({ maxRetries: 3 });
  const result = rh.execute(() => 'ok');
  assert.equal(result, 'ok');
});

test('retries on failure then succeeds', () => {
  const rh = createRetryHandler({ maxRetries: 3 });
  let attempt = 0;
  const result = rh.execute(() => { attempt++; if (attempt < 3) throw new Error('fail'); return 'done'; });
  assert.equal(result, 'done');
  assert.equal(attempt, 3);
});

test('exhausts retries and throws', () => {
  const rh = createRetryHandler({ maxRetries: 2 });
  assert.throws(() => rh.execute(() => { throw new Error('always'); }));
});

console.log('\n\x1b[36m  Part 2: Backoff Strategy\x1b[0m');
test('backoff-strategy.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/backoff-strategy.mjs'));
});

const { exponentialBackoff, linearBackoff, constantBackoff } = await import('../../tools/ogu/commands/lib/backoff-strategy.mjs');

test('exponential backoff doubles', () => {
  assert.equal(exponentialBackoff(0, 100), 100);
  assert.equal(exponentialBackoff(1, 100), 200);
  assert.equal(exponentialBackoff(2, 100), 400);
});

test('linear backoff increments', () => {
  assert.equal(linearBackoff(0, 100), 100);
  assert.equal(linearBackoff(1, 100), 200);
  assert.equal(linearBackoff(2, 100), 300);
});

test('constant backoff stays same', () => {
  assert.equal(constantBackoff(0, 100), 100);
  assert.equal(constantBackoff(5, 100), 100);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
