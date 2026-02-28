import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 251 — FIFO Queue + LIFO Stack\x1b[0m\n');

console.log('\x1b[36m  Part 1: FIFO Queue\x1b[0m');
test('fifo-queue.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/fifo-queue.mjs'));
});

const { createFIFOQueue } = await import('../../tools/ogu/commands/lib/fifo-queue.mjs');

test('enqueue and dequeue in order', () => {
  const q = createFIFOQueue();
  q.enqueue('a'); q.enqueue('b'); q.enqueue('c');
  assert.equal(q.dequeue(), 'a');
  assert.equal(q.dequeue(), 'b');
});

test('peek returns front without removing', () => {
  const q = createFIFOQueue();
  q.enqueue(1);
  assert.equal(q.peek(), 1);
  assert.equal(q.size(), 1);
});

test('isEmpty works', () => {
  const q = createFIFOQueue();
  assert.ok(q.isEmpty());
  q.enqueue(1);
  assert.ok(!q.isEmpty());
});

console.log('\n\x1b[36m  Part 2: LIFO Stack\x1b[0m');
test('lifo-stack.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/lifo-stack.mjs'));
});

const { createLIFOStack } = await import('../../tools/ogu/commands/lib/lifo-stack.mjs');

test('push and pop in reverse order', () => {
  const s = createLIFOStack();
  s.push('a'); s.push('b'); s.push('c');
  assert.equal(s.pop(), 'c');
  assert.equal(s.pop(), 'b');
});

test('peek returns top', () => {
  const s = createLIFOStack();
  s.push(42);
  assert.equal(s.peek(), 42);
  assert.equal(s.size(), 1);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
