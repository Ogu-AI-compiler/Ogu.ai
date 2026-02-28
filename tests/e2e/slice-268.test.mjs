import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 268 — Tree Diff + Tree Patcher\x1b[0m\n');

console.log('\x1b[36m  Part 1: Tree Diff\x1b[0m');
test('tree-diff.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/tree-diff.mjs'));
});

const { treeDiff } = await import('../../tools/ogu/commands/lib/tree-diff.mjs');

test('detect added keys', () => {
  const ops = treeDiff({ a: 1 }, { a: 1, b: 2 });
  assert.ok(ops.some(o => o.op === 'add' && o.path === '/b'));
});

test('detect removed keys', () => {
  const ops = treeDiff({ a: 1, b: 2 }, { a: 1 });
  assert.ok(ops.some(o => o.op === 'remove' && o.path === '/b'));
});

test('detect changed values', () => {
  const ops = treeDiff({ a: 1 }, { a: 2 });
  assert.ok(ops.some(o => o.op === 'replace' && o.path === '/a'));
});

console.log('\n\x1b[36m  Part 2: Tree Patcher\x1b[0m');
test('tree-patcher.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/tree-patcher.mjs'));
});

const { patchTree } = await import('../../tools/ogu/commands/lib/tree-patcher.mjs');

test('apply add patch', () => {
  const result = patchTree({ a: 1 }, [{ op: 'add', path: '/b', value: 2 }]);
  assert.equal(result.b, 2);
});

test('apply remove patch', () => {
  const result = patchTree({ a: 1, b: 2 }, [{ op: 'remove', path: '/b' }]);
  assert.equal(result.b, undefined);
});

test('apply replace patch', () => {
  const result = patchTree({ a: 1 }, [{ op: 'replace', path: '/a', value: 99 }]);
  assert.equal(result.a, 99);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
