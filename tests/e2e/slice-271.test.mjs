import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 271 — Rope String + Gap Buffer\x1b[0m\n');

console.log('\x1b[36m  Part 1: Rope String\x1b[0m');
test('rope-string.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/rope-string.mjs'));
});

const { createRope } = await import('../../tools/ogu/commands/lib/rope-string.mjs');

test('build and toString', () => {
  const r = createRope('Hello World');
  assert.equal(r.toString(), 'Hello World');
});

test('insert into rope', () => {
  const r = createRope('Hello World');
  r.insert(5, ' Beautiful');
  assert.equal(r.toString(), 'Hello Beautiful World');
});

test('length is correct', () => {
  const r = createRope('abc');
  assert.equal(r.length(), 3);
});

console.log('\n\x1b[36m  Part 2: Gap Buffer\x1b[0m');
test('gap-buffer.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/gap-buffer.mjs'));
});

const { createGapBuffer } = await import('../../tools/ogu/commands/lib/gap-buffer.mjs');

test('insert and get content', () => {
  const gb = createGapBuffer();
  gb.insert('Hello');
  assert.equal(gb.toString(), 'Hello');
});

test('moveCursor and insert at position', () => {
  const gb = createGapBuffer();
  gb.insert('Hllo');
  gb.moveCursor(1);
  gb.insert('e');
  assert.equal(gb.toString(), 'Hello');
});

test('delete removes char', () => {
  const gb = createGapBuffer();
  gb.insert('Helllo');
  gb.moveCursor(4);
  gb.deleteChar();
  assert.equal(gb.toString(), 'Hello');
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
