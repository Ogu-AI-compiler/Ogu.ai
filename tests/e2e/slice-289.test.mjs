import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 289 — KD-Tree + Ball Tree\x1b[0m\n');

console.log('\x1b[36m  Part 1: KD-Tree\x1b[0m');
test('kd-tree.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/kd-tree.mjs'));
});

const { createKDTree } = await import('../../tools/ogu/commands/lib/kd-tree.mjs');

test('insert and nearest neighbor', () => {
  const kdt = createKDTree(2);
  kdt.insert([1,1]); kdt.insert([5,5]); kdt.insert([3,3]);
  const nn = kdt.nearest([2,2]);
  assert.deepEqual(nn, [1,1]);
});

test('range search', () => {
  const kdt = createKDTree(2);
  kdt.insert([1,1]); kdt.insert([5,5]); kdt.insert([3,3]);
  const results = kdt.rangeSearch([0,0], [4,4]);
  assert.ok(results.length >= 2);
});

console.log('\n\x1b[36m  Part 2: Ball Tree\x1b[0m');
test('ball-tree.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/ball-tree.mjs'));
});

const { createBallTree } = await import('../../tools/ogu/commands/lib/ball-tree.mjs');

test('insert and query', () => {
  const bt = createBallTree();
  bt.insert([1,1]); bt.insert([5,5]); bt.insert([10,10]);
  const nn = bt.nearest([4,4]);
  assert.deepEqual(nn, [5,5]);
});

test('kNearest returns k points', () => {
  const bt = createBallTree();
  bt.insert([1,1]); bt.insert([2,2]); bt.insert([10,10]);
  const results = bt.kNearest([0,0], 2);
  assert.equal(results.length, 2);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
