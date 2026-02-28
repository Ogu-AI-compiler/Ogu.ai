import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 273 — Persistent Array + Persistent Map\x1b[0m\n');

console.log('\x1b[36m  Part 1: Persistent Array\x1b[0m');
test('persistent-array.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/persistent-array.mjs'));
});

const { createPersistentArray } = await import('../../tools/ogu/commands/lib/persistent-array.mjs');

test('set returns new version', () => {
  const a = createPersistentArray([1, 2, 3]);
  const b = a.set(1, 99);
  assert.equal(a.get(1), 2);
  assert.equal(b.get(1), 99);
});

test('push returns new version', () => {
  const a = createPersistentArray([1]);
  const b = a.push(2);
  assert.equal(a.size(), 1);
  assert.equal(b.size(), 2);
});

console.log('\n\x1b[36m  Part 2: Persistent Map\x1b[0m');
test('persistent-map.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/persistent-map.mjs'));
});

const { createPersistentMap } = await import('../../tools/ogu/commands/lib/persistent-map.mjs');

test('set returns new version', () => {
  const m = createPersistentMap();
  const m2 = m.set('a', 1);
  assert.equal(m.get('a'), undefined);
  assert.equal(m2.get('a'), 1);
});

test('delete returns new version', () => {
  const m = createPersistentMap().set('a', 1);
  const m2 = m.delete('a');
  assert.equal(m.get('a'), 1);
  assert.equal(m2.get('a'), undefined);
});

test('size tracks entries', () => {
  const m = createPersistentMap().set('a', 1).set('b', 2);
  assert.equal(m.size(), 2);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
