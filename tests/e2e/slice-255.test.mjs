import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 255 — Promise Pool + Async Queue\x1b[0m\n');

console.log('\x1b[36m  Part 1: Promise Pool\x1b[0m');
test('promise-pool.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/promise-pool.mjs'));
});

const { createPromisePool } = await import('../../tools/ogu/commands/lib/promise-pool.mjs');

test('run tasks with concurrency limit', async () => {
  const pool = createPromisePool(2);
  const results = [];
  pool.add(() => new Promise(r => { results.push(1); r(); }));
  pool.add(() => new Promise(r => { results.push(2); r(); }));
  pool.add(() => new Promise(r => { results.push(3); r(); }));
  await pool.drain();
  assert.equal(results.length, 3);
});

test('getStats reports completed', async () => {
  const pool = createPromisePool(3);
  pool.add(() => Promise.resolve());
  pool.add(() => Promise.resolve());
  await pool.drain();
  const stats = pool.getStats();
  assert.equal(stats.completed, 2);
});

console.log('\n\x1b[36m  Part 2: Async Queue\x1b[0m');
test('async-queue.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/async-queue.mjs'));
});

const { createAsyncQueue } = await import('../../tools/ogu/commands/lib/async-queue.mjs');

test('enqueue and process', async () => {
  const results = [];
  const q = createAsyncQueue(async (item) => { results.push(item * 2); });
  q.enqueue(1);
  q.enqueue(2);
  q.enqueue(3);
  await q.drain();
  assert.deepEqual(results, [2, 4, 6]);
});

test('getStats reports queue state', async () => {
  const q = createAsyncQueue(async () => {});
  q.enqueue('a');
  await q.drain();
  const stats = q.getStats();
  assert.equal(stats.processed, 1);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
