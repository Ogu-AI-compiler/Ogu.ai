import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 323 — Key Derivation + Hash Chain\x1b[0m\n');
console.log('\x1b[36m  Part 1: Key Derivation\x1b[0m');
test('key-derivation.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/key-derivation.mjs')));
const { deriveKey, deriveKeyPair } = await import('../../tools/ogu/commands/lib/key-derivation.mjs');
test('deterministic derivation', () => { const k1 = deriveKey('pass', 'salt'); const k2 = deriveKey('pass', 'salt'); assert.equal(k1, k2); });
test('different passwords differ', () => { const k1 = deriveKey('pass1', 'salt'); const k2 = deriveKey('pass2', 'salt'); assert.notEqual(k1, k2); });
test('different salts differ', () => { const k1 = deriveKey('pass', 'salt1'); const k2 = deriveKey('pass', 'salt2'); assert.notEqual(k1, k2); });
test('derive key pair', () => { const kp = deriveKeyPair('pass', 'salt'); assert.ok(kp.privateKey); assert.ok(kp.publicKey); assert.notEqual(kp.privateKey, kp.publicKey); });

console.log('\n\x1b[36m  Part 2: Hash Chain\x1b[0m');
test('hash-chain.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/hash-chain.mjs')));
const { createHashChain } = await import('../../tools/ogu/commands/lib/hash-chain.mjs');
test('append and verify', () => { const hc = createHashChain(); hc.append('block1'); hc.append('block2'); assert.ok(hc.verify()); });
test('chain length', () => { const hc = createHashChain(); hc.append('a'); hc.append('b'); hc.append('c'); assert.equal(hc.length(), 3); });
test('chain links', () => { const hc = createHashChain(); hc.append('x'); const chain = hc.getChain(); assert.equal(chain[0].prev, '00000000'); });
test('deterministic hashes', () => { const hc1 = createHashChain(); const hc2 = createHashChain(); const h1 = hc1.append('data'); const h2 = hc2.append('data'); assert.equal(h1, h2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
