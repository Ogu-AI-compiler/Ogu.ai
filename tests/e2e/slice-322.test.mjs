import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 322 — Env Resolver + Secret Vault\x1b[0m\n');
console.log('\x1b[36m  Part 1: Env Resolver\x1b[0m');
test('env-resolver.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/env-resolver.mjs')));
const { createEnvResolver } = await import('../../tools/ogu/commands/lib/env-resolver.mjs');
test('resolve from env', () => { const er = createEnvResolver({ PORT: '3000' }); assert.equal(er.resolve('PORT'), '3000'); });
test('default fallback', () => { const er = createEnvResolver({}); er.setDefault('HOST', 'localhost'); assert.equal(er.resolve('HOST'), 'localhost'); });
test('override wins', () => { const er = createEnvResolver({ PORT: '3000' }); er.override('PORT', '8080'); assert.equal(er.resolve('PORT'), '8080'); });
test('resolveAll', () => { const er = createEnvResolver({ A: '1', B: '2' }); const r = er.resolveAll(['A', 'B']); assert.equal(r.A, '1'); assert.equal(r.B, '2'); });
test('has check', () => { const er = createEnvResolver({ X: '1' }); assert.ok(er.has('X')); assert.ok(!er.has('Y')); });

console.log('\n\x1b[36m  Part 2: Secret Vault\x1b[0m');
test('secret-vault.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/secret-vault.mjs')));
const { createSecretVault } = await import('../../tools/ogu/commands/lib/secret-vault.mjs');
test('store and retrieve', () => { const sv = createSecretVault(); sv.store('api-key', 'abc123', 'admin'); assert.equal(sv.retrieve('api-key', 'user'), 'abc123'); });
test('revoke by owner', () => { const sv = createSecretVault(); sv.store('k', 'v', 'alice'); assert.ok(sv.revoke('k', 'alice')); assert.equal(sv.retrieve('k', 'anyone'), null); });
test('revoke denied for non-owner', () => { const sv = createSecretVault(); sv.store('k', 'v', 'alice'); assert.ok(!sv.revoke('k', 'bob')); });
test('access log', () => { const sv = createSecretVault(); sv.store('k', 'v', 'o'); sv.retrieve('k', 'u1'); sv.retrieve('k', 'u2'); assert.equal(sv.getAccessLog().length, 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
