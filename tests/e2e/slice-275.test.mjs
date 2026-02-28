import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 275 — Dancing Links + Exact Cover\x1b[0m\n');

console.log('\x1b[36m  Part 1: Dancing Links\x1b[0m');
test('dancing-links.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/dancing-links.mjs'));
});

const { createDancingLinks } = await import('../../tools/ogu/commands/lib/dancing-links.mjs');

test('cover and uncover column', () => {
  const dlx = createDancingLinks(3);
  dlx.addRow([0, 1]);
  dlx.addRow([1, 2]);
  dlx.cover(0);
  assert.ok(!dlx.isActive(0));
  dlx.uncover(0);
  assert.ok(dlx.isActive(0));
});

console.log('\n\x1b[36m  Part 2: Exact Cover\x1b[0m');
test('exact-cover.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/exact-cover.mjs'));
});

const { solveExactCover } = await import('../../tools/ogu/commands/lib/exact-cover.mjs');

test('find exact cover', () => {
  const matrix = [
    [1, 0, 0, 1],
    [1, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 1]
  ];
  const solution = solveExactCover(matrix);
  assert.ok(solution !== null);
  assert.ok(solution.length > 0);
});

test('no solution returns null', () => {
  const matrix = [
    [1, 0],
    [1, 0]
  ];
  const solution = solveExactCover(matrix);
  assert.equal(solution, null);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
