import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 317 — Token Refresher + Session Store\x1b[0m\n');
console.log('\x1b[36m  Part 1: Token Refresher\x1b[0m');
test('token-refresher.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/token-refresher.mjs')));
const { createTokenRefresher } = await import('../../tools/ogu/commands/lib/token-refresher.mjs');
test('get token', () => { let c = 0; const tr = createTokenRefresher(() => `tok_${++c}`, 1000); assert.equal(tr.getToken(100), 'tok_1'); });
test('cached within TTL', () => { let c = 0; const tr = createTokenRefresher(() => `tok_${++c}`, 1000); tr.getToken(100); assert.equal(tr.getToken(500), 'tok_1'); });
test('refresh after TTL', () => { let c = 0; const tr = createTokenRefresher(() => `tok_${++c}`, 100); tr.getToken(100); assert.equal(tr.getToken(250), 'tok_2'); });
test('invalidate forces refresh', () => { let c = 0; const tr = createTokenRefresher(() => `tok_${++c}`, 10000); tr.getToken(100); tr.invalidate(); assert.equal(tr.getToken(150), 'tok_2'); });
test('refresh count', () => { let c = 0; const tr = createTokenRefresher(() => ++c, 50); tr.getToken(0); tr.getToken(100); assert.equal(tr.getRefreshCount(), 2); });

console.log('\n\x1b[36m  Part 2: Session Store\x1b[0m');
test('session-store.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/session-store.mjs')));
const { createSessionStore } = await import('../../tools/ogu/commands/lib/session-store.mjs');
test('create and get session', () => { const ss = createSessionStore(60000); const id = ss.create({ user: 'alice' }); assert.deepEqual(ss.get(id), { user: 'alice' }); });
test('update session', () => { const ss = createSessionStore(60000); const id = ss.create({ a: 1 }); ss.set(id, { b: 2 }); assert.deepEqual(ss.get(id), { a: 1, b: 2 }); });
test('destroy session', () => { const ss = createSessionStore(60000); const id = ss.create({}); ss.destroy(id); assert.equal(ss.get(id), null); });
test('count sessions', () => { const ss = createSessionStore(60000); ss.create({}); ss.create({}); assert.equal(ss.count(), 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
