import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 278 — Zobrist Hash + Transposition Table\x1b[0m\n');

console.log('\x1b[36m  Part 1: Zobrist Hash\x1b[0m');
test('zobrist-hash.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/zobrist-hash.mjs'));
});

const { createZobristHash } = await import('../../tools/ogu/commands/lib/zobrist-hash.mjs');

test('hash changes with toggle', () => {
  const zh = createZobristHash(8, 2);
  const h1 = zh.getHash();
  zh.toggle(0, 0);
  const h2 = zh.getHash();
  assert.notEqual(h1, h2);
});

test('toggle twice restores hash', () => {
  const zh = createZobristHash(8, 2);
  const h1 = zh.getHash();
  zh.toggle(3, 1);
  zh.toggle(3, 1);
  assert.equal(zh.getHash(), h1);
});

console.log('\n\x1b[36m  Part 2: Transposition Table\x1b[0m');
test('transposition-table.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/transposition-table.mjs'));
});

const { createTranspositionTable } = await import('../../tools/ogu/commands/lib/transposition-table.mjs');

test('store and retrieve', () => {
  const tt = createTranspositionTable(1024);
  tt.store(12345, { score: 10, depth: 3 });
  const entry = tt.lookup(12345);
  assert.equal(entry.score, 10);
});

test('miss returns null', () => {
  const tt = createTranspositionTable(1024);
  assert.equal(tt.lookup(99999), null);
});

test('getStats tracks usage', () => {
  const tt = createTranspositionTable(10);
  tt.store(1, { s: 1 });
  tt.lookup(1);
  tt.lookup(2);
  const stats = tt.getStats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 1);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
