import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 365 — Task Queue + Job Worker\x1b[0m\n');
console.log('\x1b[36m  Part 1: Task Queue\x1b[0m');
test('task-queue.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/task-queue.mjs')));
const { createTaskQueue } = await import('../../tools/ogu/commands/lib/task-queue.mjs');
test('add and process', () => { const tq = createTaskQueue(); tq.add('t1', () => 42); assert.equal(tq.processNext(), 42); });
test('priority ordering', () => { const tq = createTaskQueue(); const order = []; tq.add('low', () => order.push('low'), 1); tq.add('high', () => order.push('high'), 10); tq.drain(); assert.deepEqual(order, ['high', 'low']); });
test('stats', () => { const tq = createTaskQueue(); tq.add('t', () => 1); assert.equal(tq.getStats().pending, 1); tq.processNext(); assert.equal(tq.getStats().completed, 1); });

console.log('\n\x1b[36m  Part 2: Job Worker\x1b[0m');
test('job-worker.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/job-worker.mjs')));
const { createJobWorker } = await import('../../tools/ogu/commands/lib/job-worker.mjs');
test('process job', () => { const w = createJobWorker('w1', j => j.x * 2); const r = w.process({ x: 5 }); assert.equal(r.status, 'done'); assert.equal(r.result, 10); });
test('handle error', () => { const w = createJobWorker('w1', () => { throw new Error('fail'); }); const r = w.process({}); assert.equal(r.status, 'error'); });
test('process batch', () => { const w = createJobWorker('w1', j => j.n + 1); const r = w.processBatch([{ n: 1 }, { n: 2 }]); assert.equal(r[0].result, 2); assert.equal(r[1].result, 3); });
test('stats tracking', () => { const w = createJobWorker('w1', j => j); w.process(1); w.process(2); assert.equal(w.getStats().jobsProcessed, 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
