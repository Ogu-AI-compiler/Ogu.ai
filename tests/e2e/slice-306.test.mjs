import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 306 — Binary Heap + Priority Queue Advanced\x1b[0m\n');
console.log('\x1b[36m  Part 1: Binary Heap\x1b[0m');
test('binary-heap.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/binary-heap.mjs')));
const { createBinaryHeap } = await import('../../tools/ogu/commands/lib/binary-heap.mjs');
test('min heap extracts minimum', () => { const h = createBinaryHeap((a,b)=>a-b); h.insert(5); h.insert(2); h.insert(8); assert.equal(h.extract(), 2); });
test('size tracks elements', () => { const h = createBinaryHeap((a,b)=>a-b); h.insert(1); h.insert(2); assert.equal(h.size(), 2); });

console.log('\n\x1b[36m  Part 2: Priority Queue Advanced\x1b[0m');
test('priority-queue-advanced.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/priority-queue-advanced.mjs')));
const { createPriorityQueueAdvanced } = await import('../../tools/ogu/commands/lib/priority-queue-advanced.mjs');
test('dequeue highest priority', () => { const pq = createPriorityQueueAdvanced(); pq.enqueue('low',1); pq.enqueue('high',10); assert.equal(pq.dequeue(), 'high'); });
test('peek without removing', () => { const pq = createPriorityQueueAdvanced(); pq.enqueue('a',5); assert.equal(pq.peek(), 'a'); assert.equal(pq.size(), 1); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
