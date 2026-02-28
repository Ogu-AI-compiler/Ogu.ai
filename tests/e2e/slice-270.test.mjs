import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 270 — HyperLogLog + Cuckoo Filter\x1b[0m\n');

console.log('\x1b[36m  Part 1: HyperLogLog\x1b[0m');
test('hyperloglog.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/hyperloglog.mjs'));
});

const { createHyperLogLog } = await import('../../tools/ogu/commands/lib/hyperloglog.mjs');

test('add and estimate cardinality', () => {
  const hll = createHyperLogLog(256);
  for (let i = 0; i < 1000; i++) hll.add(`item-${i}`);
  const estimate = hll.estimate();
  assert.ok(estimate > 200 && estimate < 5000, `estimate was ${estimate}`);
});

test('empty estimate is 0', () => {
  const hll = createHyperLogLog(16);
  assert.equal(hll.estimate(), 0);
});

console.log('\n\x1b[36m  Part 2: Cuckoo Filter\x1b[0m');
test('cuckoo-filter.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/cuckoo-filter.mjs'));
});

const { createCuckooFilter } = await import('../../tools/ogu/commands/lib/cuckoo-filter.mjs');

test('insert and lookup', () => {
  const cf = createCuckooFilter(100);
  cf.insert('apple');
  assert.ok(cf.lookup('apple'));
});

test('lookup missing returns false', () => {
  const cf = createCuckooFilter(100);
  assert.ok(!cf.lookup('banana'));
});

test('delete removes item', () => {
  const cf = createCuckooFilter(100);
  cf.insert('cherry');
  cf.delete('cherry');
  assert.ok(!cf.lookup('cherry'));
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
