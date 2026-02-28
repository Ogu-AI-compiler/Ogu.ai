import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 307 — Byte Encoder + Varint Codec\x1b[0m\n');
console.log('\x1b[36m  Part 1: Byte Encoder\x1b[0m');
test('byte-encoder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/byte-encoder.mjs')));
const { encodeUtf8, decodeUtf8, toHex, fromHex } = await import('../../tools/ogu/commands/lib/byte-encoder.mjs');
test('encode/decode utf8', () => { const bytes = encodeUtf8('hello'); assert.equal(decodeUtf8(bytes), 'hello'); });
test('hex round-trip', () => { const hex = toHex([0xDE,0xAD]); assert.equal(hex, 'dead'); assert.deepEqual(fromHex('dead'), [0xDE,0xAD]); });

console.log('\n\x1b[36m  Part 2: Varint Codec\x1b[0m');
test('varint-codec.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/varint-codec.mjs')));
const { encodeVarint, decodeVarint } = await import('../../tools/ogu/commands/lib/varint-codec.mjs');
test('encode/decode small number', () => { const encoded = encodeVarint(300); const decoded = decodeVarint(encoded); assert.equal(decoded.value, 300); });
test('encode/decode zero', () => { assert.equal(decodeVarint(encodeVarint(0)).value, 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
