import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 247 — TLB Cache + Address Translator\x1b[0m\n');

console.log('\x1b[36m  Part 1: TLB Cache\x1b[0m');
test('tlb-cache.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/tlb-cache.mjs'));
});

const { createTLBCache } = await import('../../tools/ogu/commands/lib/tlb-cache.mjs');

test('insert and lookup TLB entry', () => {
  const tlb = createTLBCache({ capacity: 4 });
  tlb.insert(10, 200);
  assert.equal(tlb.lookup(10), 200);
});

test('miss returns null', () => {
  const tlb = createTLBCache({ capacity: 4 });
  assert.equal(tlb.lookup(99), null);
});

test('evicts on capacity', () => {
  const tlb = createTLBCache({ capacity: 2 });
  tlb.insert(1, 100);
  tlb.insert(2, 200);
  tlb.insert(3, 300);
  assert.equal(tlb.lookup(1), null);
  assert.equal(tlb.lookup(3), 300);
});

test('getStats tracks hits and misses', () => {
  const tlb = createTLBCache({ capacity: 4 });
  tlb.insert(1, 10);
  tlb.lookup(1);
  tlb.lookup(99);
  const stats = tlb.getStats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 1);
});

console.log('\n\x1b[36m  Part 2: Address Translator\x1b[0m');
test('address-translator.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/address-translator.mjs'));
});

const { createAddressTranslator } = await import('../../tools/ogu/commands/lib/address-translator.mjs');

test('translate virtual to physical', () => {
  const at = createAddressTranslator({ pageSize: 4096 });
  at.mapPage(0, 5);
  const result = at.translate(100);
  assert.equal(result.frame, 5);
  assert.equal(result.offset, 100);
});

test('unmapped page returns null', () => {
  const at = createAddressTranslator({ pageSize: 4096 });
  assert.equal(at.translate(8192), null);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
