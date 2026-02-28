import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 308 — Protocol Buffer Lite + Message Packer\x1b[0m\n');
console.log('\x1b[36m  Part 1: Protocol Buffer Lite\x1b[0m');
test('protocol-buffer-lite.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/protocol-buffer-lite.mjs')));
const { createProtobufLite } = await import('../../tools/ogu/commands/lib/protocol-buffer-lite.mjs');
test('encode and decode message', () => { const pb = createProtobufLite(); pb.defineMessage('User', { name: 'string', age: 'int' }); const buf = pb.encode('User', { name: 'Alice', age: 30 }); const decoded = pb.decode('User', buf); assert.equal(decoded.name, 'Alice'); assert.equal(decoded.age, 30); });

console.log('\n\x1b[36m  Part 2: Message Packer\x1b[0m');
test('message-packer.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/message-packer.mjs')));
const { pack, unpack } = await import('../../tools/ogu/commands/lib/message-packer.mjs');
test('pack and unpack', () => { const packed = pack({ type: 'hello', data: [1,2,3] }); const unpacked = unpack(packed); assert.equal(unpacked.type, 'hello'); assert.deepEqual(unpacked.data, [1,2,3]); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
