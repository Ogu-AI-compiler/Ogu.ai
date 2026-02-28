import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 246 — Virtual Memory Manager + Page Table\x1b[0m\n');

console.log('\x1b[36m  Part 1: Virtual Memory Manager\x1b[0m');
test('virtual-memory-manager.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/virtual-memory-manager.mjs'));
});

const { createVirtualMemoryManager } = await import('../../tools/ogu/commands/lib/virtual-memory-manager.mjs');

test('allocate returns virtual address', () => {
  const vmm = createVirtualMemoryManager({ pageSize: 4096, totalPages: 16 });
  const addr = vmm.allocate(1);
  assert.equal(typeof addr, 'number');
  assert.ok(addr >= 0);
});

test('free releases pages', () => {
  const vmm = createVirtualMemoryManager({ pageSize: 4096, totalPages: 4 });
  const a1 = vmm.allocate(2);
  vmm.free(a1);
  const stats = vmm.getStats();
  assert.equal(stats.usedPages, 0);
});

test('getStats reports usage', () => {
  const vmm = createVirtualMemoryManager({ pageSize: 4096, totalPages: 8 });
  vmm.allocate(3);
  const stats = vmm.getStats();
  assert.equal(stats.usedPages, 3);
  assert.equal(stats.freePages, 5);
});

console.log('\n\x1b[36m  Part 2: Page Table\x1b[0m');
test('page-table.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/page-table.mjs'));
});

const { createPageTable } = await import('../../tools/ogu/commands/lib/page-table.mjs');

test('map and translate address', () => {
  const pt = createPageTable({ pageSize: 4096 });
  pt.map(0, 100);
  const physical = pt.translate(0);
  assert.equal(physical, 100);
});

test('unmap removes mapping', () => {
  const pt = createPageTable({ pageSize: 4096 });
  pt.map(5, 200);
  pt.unmap(5);
  assert.equal(pt.translate(5), null);
});

test('getEntries lists mappings', () => {
  const pt = createPageTable({ pageSize: 4096 });
  pt.map(1, 10);
  pt.map(2, 20);
  const entries = pt.getEntries();
  assert.equal(entries.length, 2);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
