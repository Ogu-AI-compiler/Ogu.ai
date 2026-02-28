import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 316 — Rate Limiter Window + Sliding Window Counter\x1b[0m\n');
console.log('\x1b[36m  Part 1: Rate Limiter Window\x1b[0m');
test('rate-limiter-window.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/rate-limiter-window.mjs')));
const { createRateLimiterWindow } = await import('../../tools/ogu/commands/lib/rate-limiter-window.mjs');
test('allow within limit', () => { const rl = createRateLimiterWindow(3, 1000); assert.ok(rl.allow('k', 100)); assert.ok(rl.allow('k', 200)); assert.ok(rl.allow('k', 300)); });
test('block over limit', () => { const rl = createRateLimiterWindow(2, 1000); rl.allow('k', 100); rl.allow('k', 200); assert.ok(!rl.allow('k', 300)); });
test('window expiry', () => { const rl = createRateLimiterWindow(1, 100); rl.allow('k', 100); assert.ok(!rl.allow('k', 150)); assert.ok(rl.allow('k', 250)); });
test('remaining count', () => { const rl = createRateLimiterWindow(3, 1000); rl.allow('k', 100); assert.equal(rl.remaining('k', 100), 2); });
test('reset key', () => { const rl = createRateLimiterWindow(1, 1000); rl.allow('k', 100); rl.reset('k'); assert.ok(rl.allow('k', 200)); });

console.log('\n\x1b[36m  Part 2: Sliding Window Counter\x1b[0m');
test('sliding-window-counter.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/sliding-window-counter.mjs')));
const { createSlidingWindowCounter } = await import('../../tools/ogu/commands/lib/sliding-window-counter.mjs');
test('count events in window', () => { const sw = createSlidingWindowCounter(1000); sw.add(100); sw.add(200); sw.add(300); assert.equal(sw.count(500), 3); });
test('expired events excluded', () => { const sw = createSlidingWindowCounter(100); sw.add(100); sw.add(200); assert.equal(sw.count(250), 1); });
test('prune old events', () => { const sw = createSlidingWindowCounter(100); sw.add(100); sw.add(200); sw.prune(250); assert.equal(sw.getAll().length, 1); });
test('reset clears', () => { const sw = createSlidingWindowCounter(1000); sw.add(100); sw.reset(); assert.equal(sw.count(200), 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
