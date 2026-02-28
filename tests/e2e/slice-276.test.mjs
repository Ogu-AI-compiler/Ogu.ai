import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 276 — A-Star Search + Minimax Engine\x1b[0m\n');

console.log('\x1b[36m  Part 1: A-Star Search\x1b[0m');
test('a-star-search.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/a-star-search.mjs'));
});

const { astar } = await import('../../tools/ogu/commands/lib/a-star-search.mjs');

test('find shortest path', () => {
  const graph = { A: [{ to: 'B', cost: 1 }, { to: 'C', cost: 4 }], B: [{ to: 'C', cost: 1 }], C: [] };
  const h = () => 0;
  const path = astar(graph, 'A', 'C', h);
  assert.deepEqual(path, ['A', 'B', 'C']);
});

test('no path returns null', () => {
  const graph = { A: [], B: [] };
  const path = astar(graph, 'A', 'B', () => 0);
  assert.equal(path, null);
});

console.log('\n\x1b[36m  Part 2: Minimax Engine\x1b[0m');
test('minimax-engine.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/minimax-engine.mjs'));
});

const { minimax } = await import('../../tools/ogu/commands/lib/minimax-engine.mjs');

test('evaluate simple game tree', () => {
  const node = { value: null, children: [{ value: 3, children: [] }, { value: 5, children: [] }] };
  const score = minimax(node, true);
  assert.equal(score, 5);
});

test('minimizer picks lowest', () => {
  const node = { value: null, children: [{ value: 3, children: [] }, { value: 5, children: [] }] };
  const score = minimax(node, false);
  assert.equal(score, 3);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
