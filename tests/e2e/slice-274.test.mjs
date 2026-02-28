import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 274 — Van Emde Boas + Treap\x1b[0m\n');

console.log('\x1b[36m  Part 1: Van Emde Boas\x1b[0m');
test('van-emde-boas.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/van-emde-boas.mjs'));
});

const { createVanEmdeBoas } = await import('../../tools/ogu/commands/lib/van-emde-boas.mjs');

test('insert and member', () => {
  const veb = createVanEmdeBoas(16);
  veb.insert(5);
  veb.insert(10);
  assert.ok(veb.member(5));
  assert.ok(!veb.member(3));
});

test('min and max', () => {
  const veb = createVanEmdeBoas(16);
  veb.insert(3); veb.insert(7); veb.insert(1);
  assert.equal(veb.min(), 1);
  assert.equal(veb.max(), 7);
});

console.log('\n\x1b[36m  Part 2: Treap\x1b[0m');
test('treap.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/treap.mjs'));
});

const { createTreap } = await import('../../tools/ogu/commands/lib/treap.mjs');

test('insert and search', () => {
  const t = createTreap();
  t.insert(5); t.insert(3); t.insert(8);
  assert.ok(t.search(5));
  assert.ok(!t.search(99));
});

test('inOrder returns sorted', () => {
  const t = createTreap();
  t.insert(5); t.insert(1); t.insert(9); t.insert(3);
  const arr = t.inOrder();
  assert.deepEqual(arr, [1, 3, 5, 9]);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
