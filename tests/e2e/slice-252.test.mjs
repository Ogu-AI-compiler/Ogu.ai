import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 252 — Bounded Buffer + Producer Consumer\x1b[0m\n');

console.log('\x1b[36m  Part 1: Bounded Buffer\x1b[0m');
test('bounded-buffer.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/bounded-buffer.mjs'));
});

const { createBoundedBuffer } = await import('../../tools/ogu/commands/lib/bounded-buffer.mjs');

test('put and take items', () => {
  const bb = createBoundedBuffer(3);
  bb.put('x');
  bb.put('y');
  assert.equal(bb.take(), 'x');
});

test('isFull at capacity', () => {
  const bb = createBoundedBuffer(2);
  bb.put(1); bb.put(2);
  assert.ok(bb.isFull());
});

test('size tracks count', () => {
  const bb = createBoundedBuffer(5);
  bb.put(1); bb.put(2);
  assert.equal(bb.size(), 2);
  bb.take();
  assert.equal(bb.size(), 1);
});

console.log('\n\x1b[36m  Part 2: Producer Consumer\x1b[0m');
test('producer-consumer.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/producer-consumer.mjs'));
});

const { createProducerConsumer } = await import('../../tools/ogu/commands/lib/producer-consumer.mjs');

test('produce and consume', () => {
  const pc = createProducerConsumer(10);
  pc.produce('item1');
  pc.produce('item2');
  assert.equal(pc.consume(), 'item1');
});

test('getStats reports produced/consumed', () => {
  const pc = createProducerConsumer(10);
  pc.produce('a'); pc.produce('b');
  pc.consume();
  const stats = pc.getStats();
  assert.equal(stats.produced, 2);
  assert.equal(stats.consumed, 1);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
