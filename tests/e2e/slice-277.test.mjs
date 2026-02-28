import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 277 — Alpha-Beta Pruner + Game Tree\x1b[0m\n');

console.log('\x1b[36m  Part 1: Alpha-Beta Pruner\x1b[0m');
test('alpha-beta-pruner.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/alpha-beta-pruner.mjs'));
});

const { alphaBeta } = await import('../../tools/ogu/commands/lib/alpha-beta-pruner.mjs');

test('prune returns same result as minimax', () => {
  const node = {
    value: null, children: [
      { value: null, children: [{ value: 3, children: [] }, { value: 12, children: [] }] },
      { value: null, children: [{ value: 8, children: [] }, { value: 2, children: [] }] }
    ]
  };
  const score = alphaBeta(node, true, -Infinity, Infinity);
  assert.equal(score, 3);
});

console.log('\n\x1b[36m  Part 2: Game Tree\x1b[0m');
test('game-tree.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/game-tree.mjs'));
});

const { createGameTree } = await import('../../tools/ogu/commands/lib/game-tree.mjs');

test('add and get children', () => {
  const gt = createGameTree('root');
  gt.addChild('root', 'a');
  gt.addChild('root', 'b');
  assert.equal(gt.getChildren('root').length, 2);
});

test('set and get value', () => {
  const gt = createGameTree('root');
  gt.setValue('root', 10);
  assert.equal(gt.getValue('root'), 10);
});

test('getDepth calculates depth', () => {
  const gt = createGameTree('root');
  gt.addChild('root', 'a');
  gt.addChild('a', 'b');
  assert.equal(gt.getDepth('root'), 2);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
