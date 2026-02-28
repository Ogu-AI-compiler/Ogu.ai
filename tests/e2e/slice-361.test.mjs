import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 361 — OAuth Token Manager + JWT Builder\x1b[0m\n');
console.log('\x1b[36m  Part 1: OAuth Token Manager\x1b[0m');
test('oauth-token-manager.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/oauth-token-manager.mjs')));
const { createOAuthTokenManager } = await import('../../tools/ogu/commands/lib/oauth-token-manager.mjs');
test('store and get', () => { const tm = createOAuthTokenManager(); tm.store('c1', { accessToken: 'at1', refreshToken: 'rt1', expiresIn: 3600 }); assert.equal(tm.getAccessToken('c1'), 'at1'); });
test('expired token returns null', () => { const tm = createOAuthTokenManager(); tm.store('c1', { accessToken: 'at', refreshToken: 'rt', expiresIn: 0 }); assert.equal(tm.getAccessToken('c1', Date.now() + 1000), null); });
test('revoke', () => { const tm = createOAuthTokenManager(); tm.store('c1', { accessToken: 'a', refreshToken: 'r', expiresIn: 3600 }); tm.revoke('c1'); assert.equal(tm.getAccessToken('c1'), null); });

console.log('\n\x1b[36m  Part 2: JWT Builder\x1b[0m');
test('jwt-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/jwt-builder.mjs')));
const { buildJWT, decodeJWT, verifyJWT } = await import('../../tools/ogu/commands/lib/jwt-builder.mjs');
test('build and decode', () => { const token = buildJWT({ sub: 'user1' }, 'secret'); const payload = decodeJWT(token); assert.equal(payload.sub, 'user1'); });
test('verify valid token', () => { const token = buildJWT({ x: 1 }, 'secret'); assert.ok(verifyJWT(token, 'secret')); });
test('verify invalid token', () => { const token = buildJWT({ x: 1 }, 'secret'); assert.ok(!verifyJWT(token, 'wrong')); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
