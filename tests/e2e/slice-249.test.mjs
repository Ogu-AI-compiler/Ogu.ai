import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 249 — DMA Controller + Bus Arbiter\x1b[0m\n');

console.log('\x1b[36m  Part 1: DMA Controller\x1b[0m');
test('dma-controller.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/dma-controller.mjs'));
});

const { createDMAController } = await import('../../tools/ogu/commands/lib/dma-controller.mjs');

test('transfer copies data', () => {
  const dma = createDMAController();
  const src = [1, 2, 3, 4];
  const dst = [0, 0, 0, 0];
  dma.transfer(src, 0, dst, 0, 4);
  assert.deepEqual(dst, [1, 2, 3, 4]);
});

test('getStats tracks transfers', () => {
  const dma = createDMAController();
  dma.transfer([10], 0, [0], 0, 1);
  const stats = dma.getStats();
  assert.equal(stats.transfers, 1);
  assert.equal(stats.bytesTransferred, 1);
});

console.log('\n\x1b[36m  Part 2: Bus Arbiter\x1b[0m');
test('bus-arbiter.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/bus-arbiter.mjs'));
});

const { createBusArbiter } = await import('../../tools/ogu/commands/lib/bus-arbiter.mjs');

test('request and grant bus access', () => {
  const arb = createBusArbiter();
  arb.addDevice('cpu', 1);
  arb.addDevice('gpu', 2);
  arb.request('cpu');
  arb.request('gpu');
  const granted = arb.arbitrate();
  assert.equal(granted, 'gpu');
});

test('release frees bus', () => {
  const arb = createBusArbiter();
  arb.addDevice('cpu', 1);
  arb.request('cpu');
  arb.arbitrate();
  arb.release('cpu');
  assert.equal(arb.getCurrentOwner(), null);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
