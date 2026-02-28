import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 272 — Segment Range Tree + Range Query\x1b[0m\n');

console.log('\x1b[36m  Part 1: Segment Range Tree\x1b[0m');
test('segment-range-tree.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/segment-range-tree.mjs'));
});

const { createSegmentRangeTree } = await import('../../tools/ogu/commands/lib/segment-range-tree.mjs');

test('insert and query intervals', () => {
  const srt = createSegmentRangeTree();
  srt.insert(1, 5, 'a');
  srt.insert(3, 8, 'b');
  const results = srt.query(4);
  assert.ok(results.includes('a'));
  assert.ok(results.includes('b'));
});

test('no match returns empty', () => {
  const srt = createSegmentRangeTree();
  srt.insert(1, 3, 'x');
  assert.equal(srt.query(5).length, 0);
});

console.log('\n\x1b[36m  Part 2: Range Query\x1b[0m');
test('range-query.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/range-query.mjs'));
});

const { createRangeQuery } = await import('../../tools/ogu/commands/lib/range-query.mjs');

test('query range sum', () => {
  const rq = createRangeQuery([1, 2, 3, 4, 5]);
  assert.equal(rq.sum(1, 3), 9);
});

test('query range min', () => {
  const rq = createRangeQuery([5, 2, 8, 1, 9]);
  assert.equal(rq.min(0, 4), 1);
});

test('query range max', () => {
  const rq = createRangeQuery([5, 2, 8, 1, 9]);
  assert.equal(rq.max(0, 4), 9);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
