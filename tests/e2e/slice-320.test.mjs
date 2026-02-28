import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 320 — Weighted Balancer + Round Robin Scheduler\x1b[0m\n');
console.log('\x1b[36m  Part 1: Weighted Balancer\x1b[0m');
test('weighted-balancer.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/weighted-balancer.mjs')));
const { createWeightedBalancer } = await import('../../tools/ogu/commands/lib/weighted-balancer.mjs');
test('weighted distribution', () => { const wb = createWeightedBalancer(); wb.addTarget('a', 2); wb.addTarget('b', 1); const counts = { a: 0, b: 0 }; for (let i = 0; i < 9; i++) counts[wb.next()]++; assert.equal(counts.a, 6); assert.equal(counts.b, 3); });
test('remove target', () => { const wb = createWeightedBalancer(); wb.addTarget('a', 1); wb.addTarget('b', 1); wb.removeTarget('a'); assert.equal(wb.next(), 'b'); });
test('empty returns null', () => { const wb = createWeightedBalancer(); assert.equal(wb.next(), null); });
test('list targets', () => { const wb = createWeightedBalancer(); wb.addTarget('x', 3); wb.addTarget('y', 1); assert.equal(wb.list().length, 2); });

console.log('\n\x1b[36m  Part 2: Round Robin Scheduler\x1b[0m');
test('round-robin-scheduler.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/round-robin-scheduler.mjs')));
const { createRoundRobinScheduler } = await import('../../tools/ogu/commands/lib/round-robin-scheduler.mjs');
test('cycles through items', () => { const rr = createRoundRobinScheduler(); rr.add('a'); rr.add('b'); rr.add('c'); assert.equal(rr.next(), 'a'); assert.equal(rr.next(), 'b'); assert.equal(rr.next(), 'c'); assert.equal(rr.next(), 'a'); });
test('remove item', () => { const rr = createRoundRobinScheduler(); rr.add('a'); rr.add('b'); rr.remove('a'); assert.equal(rr.next(), 'b'); });
test('empty returns null', () => { const rr = createRoundRobinScheduler(); assert.equal(rr.next(), null); });
test('reset index', () => { const rr = createRoundRobinScheduler(); rr.add('a'); rr.add('b'); rr.next(); rr.reset(); assert.equal(rr.next(), 'a'); });
test('size', () => { const rr = createRoundRobinScheduler(); rr.add('x'); rr.add('y'); assert.equal(rr.size(), 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
