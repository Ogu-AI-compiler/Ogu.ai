import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 254 — Compare-And-Swap + Atomic Counter\x1b[0m\n');

console.log('\x1b[36m  Part 1: Compare-And-Swap\x1b[0m');
test('compare-and-swap.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/compare-and-swap.mjs'));
});

const { createCASRegister } = await import('../../tools/ogu/commands/lib/compare-and-swap.mjs');

test('CAS succeeds on matching expected', () => {
  const reg = createCASRegister(0);
  assert.ok(reg.compareAndSwap(0, 5));
  assert.equal(reg.get(), 5);
});

test('CAS fails on mismatch', () => {
  const reg = createCASRegister(10);
  assert.ok(!reg.compareAndSwap(0, 20));
  assert.equal(reg.get(), 10);
});

test('set forces value', () => {
  const reg = createCASRegister(0);
  reg.set(42);
  assert.equal(reg.get(), 42);
});

console.log('\n\x1b[36m  Part 2: Atomic Counter\x1b[0m');
test('atomic-counter.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/atomic-counter.mjs'));
});

const { createAtomicCounter } = await import('../../tools/ogu/commands/lib/atomic-counter.mjs');

test('increment and get', () => {
  const c = createAtomicCounter(0);
  c.increment();
  c.increment();
  assert.equal(c.get(), 2);
});

test('decrement works', () => {
  const c = createAtomicCounter(5);
  c.decrement();
  assert.equal(c.get(), 4);
});

test('getAndIncrement returns old value', () => {
  const c = createAtomicCounter(10);
  const old = c.getAndIncrement();
  assert.equal(old, 10);
  assert.equal(c.get(), 11);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
