import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 362 — API Key Manager + API Rate Tracker\x1b[0m\n');
console.log('\x1b[36m  Part 1: API Key Manager\x1b[0m');
test('api-key-manager.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/api-key-manager.mjs')));
const { createAPIKeyManager } = await import('../../tools/ogu/commands/lib/api-key-manager.mjs');
test('create and validate', () => { const km = createAPIKeyManager(); const key = km.create('test-app', ['read', 'write']); assert.ok(km.validate(key)); });
test('check scope', () => { const km = createAPIKeyManager(); const key = km.create('app', ['read']); assert.ok(km.hasScope(key, 'read')); assert.ok(!km.hasScope(key, 'admin')); });
test('revoke key', () => { const km = createAPIKeyManager(); const key = km.create('app', []); km.revoke(key); assert.ok(!km.validate(key)); });
test('list keys', () => { const km = createAPIKeyManager(); km.create('a', []); km.create('b', []); assert.equal(km.list().length, 2); });

console.log('\n\x1b[36m  Part 2: API Rate Tracker\x1b[0m');
test('api-rate-tracker.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/api-rate-tracker.mjs')));
const { createAPIRateTracker } = await import('../../tools/ogu/commands/lib/api-rate-tracker.mjs');
test('track and get rate', () => { const rt = createAPIRateTracker(); rt.record('c1', '/api', 100); rt.record('c1', '/api', 200); assert.equal(rt.getRate('c1', '/api', 1000, 500), 2); });
test('top clients', () => { const rt = createAPIRateTracker(); rt.record('c1', '/api', 100); rt.record('c1', '/api', 200); rt.record('c2', '/api', 300); const top = rt.getTopClients('/api', 1000, 500); assert.equal(top[0].id, 'c1'); });
test('reset', () => { const rt = createAPIRateTracker(); rt.record('c1', '/x', 100); rt.reset(); assert.equal(rt.getRate('c1', '/x', 1000, 200), 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
