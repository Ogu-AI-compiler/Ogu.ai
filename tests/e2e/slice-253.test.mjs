import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 253 — Read-Write Lock + Spin Lock\x1b[0m\n');

console.log('\x1b[36m  Part 1: Read-Write Lock\x1b[0m');
test('read-write-lock.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/read-write-lock.mjs'));
});

const { createReadWriteLock } = await import('../../tools/ogu/commands/lib/read-write-lock.mjs');

test('multiple readers allowed', () => {
  const rw = createReadWriteLock();
  assert.ok(rw.acquireRead());
  assert.ok(rw.acquireRead());
  assert.equal(rw.getReaders(), 2);
});

test('writer blocks readers', () => {
  const rw = createReadWriteLock();
  assert.ok(rw.acquireWrite());
  assert.ok(!rw.acquireRead());
});

test('readers block writer', () => {
  const rw = createReadWriteLock();
  rw.acquireRead();
  assert.ok(!rw.acquireWrite());
});

test('release allows next', () => {
  const rw = createReadWriteLock();
  rw.acquireWrite();
  rw.releaseWrite();
  assert.ok(rw.acquireRead());
});

console.log('\n\x1b[36m  Part 2: Spin Lock\x1b[0m');
test('spin-lock.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/spin-lock.mjs'));
});

const { createSpinLock } = await import('../../tools/ogu/commands/lib/spin-lock.mjs');

test('tryLock acquires lock', () => {
  const sl = createSpinLock();
  assert.ok(sl.tryLock());
  assert.ok(sl.isLocked());
});

test('double lock fails', () => {
  const sl = createSpinLock();
  sl.tryLock();
  assert.ok(!sl.tryLock());
});

test('unlock releases', () => {
  const sl = createSpinLock();
  sl.tryLock();
  sl.unlock();
  assert.ok(!sl.isLocked());
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
