import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 363 — Webhook Dispatcher\x1b[0m\n');
console.log('\x1b[36m  Part 1: Webhook Dispatcher\x1b[0m');
test('webhook-dispatcher.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/webhook-dispatcher.mjs')));
const { createWebhookDispatcher } = await import('../../tools/ogu/commands/lib/webhook-dispatcher.mjs');
test('register and dispatch', () => { const wd = createWebhookDispatcher(); wd.register('push', 'https://example.com/hook'); const r = wd.dispatch('push', { ref: 'main' }); assert.equal(r.length, 1); assert.ok(r[0].delivered); });
test('dispatch log', () => { const wd = createWebhookDispatcher(); wd.register('push', 'https://x.com'); wd.dispatch('push', {}); assert.equal(wd.getLog().length, 1); });
test('list events', () => { const wd = createWebhookDispatcher(); wd.register('a', 'u1'); wd.register('b', 'u2'); assert.equal(wd.listEvents().length, 2); });
test('unregister', () => { const wd = createWebhookDispatcher(); wd.register('x', 'u'); wd.unregister('x'); assert.equal(wd.dispatch('x', {}).length, 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
