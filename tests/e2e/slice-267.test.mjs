import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 267 — JSON Patch Engine + JSON Pointer\x1b[0m\n');

console.log('\x1b[36m  Part 1: JSON Patch Engine\x1b[0m');
test('json-patch-engine.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/json-patch-engine.mjs'));
});

const { applyPatch } = await import('../../tools/ogu/commands/lib/json-patch-engine.mjs');

test('add operation', () => {
  const doc = { a: 1 };
  const result = applyPatch(doc, [{ op: 'add', path: '/b', value: 2 }]);
  assert.equal(result.b, 2);
});

test('remove operation', () => {
  const doc = { a: 1, b: 2 };
  const result = applyPatch(doc, [{ op: 'remove', path: '/b' }]);
  assert.equal(result.b, undefined);
});

test('replace operation', () => {
  const doc = { a: 1 };
  const result = applyPatch(doc, [{ op: 'replace', path: '/a', value: 99 }]);
  assert.equal(result.a, 99);
});

console.log('\n\x1b[36m  Part 2: JSON Pointer\x1b[0m');
test('json-pointer.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/json-pointer.mjs'));
});

const { get, set } = await import('../../tools/ogu/commands/lib/json-pointer.mjs');

test('get nested value', () => {
  const obj = { a: { b: { c: 42 } } };
  assert.equal(get(obj, '/a/b/c'), 42);
});

test('set nested value', () => {
  const obj = { a: { b: 1 } };
  set(obj, '/a/b', 99);
  assert.equal(obj.a.b, 99);
});

test('get root returns whole object', () => {
  const obj = { x: 1 };
  assert.deepEqual(get(obj, ''), obj);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
