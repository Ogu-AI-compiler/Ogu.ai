import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 360 — SSE Emitter\x1b[0m\n');
console.log('\x1b[36m  Part 1: SSE Emitter\x1b[0m');
test('sse-emitter.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/sse-emitter.mjs')));
const { createSSEEmitter } = await import('../../tools/ogu/commands/lib/sse-emitter.mjs');
test('emit to clients', () => { const sse = createSSEEmitter(); let received = null; sse.addClient(msg => received = msg); sse.emit('update', { x: 1 }); assert.equal(received.event, 'update'); });
test('remove client', () => { const sse = createSSEEmitter(); const id = sse.addClient(() => {}); sse.removeClient(id); assert.equal(sse.clientCount(), 0); });
test('format SSE message', () => { const sse = createSSEEmitter(); const f = sse.format({ id: 1, event: 'msg', data: 'hello' }); assert.ok(f.includes('event: msg')); assert.ok(f.includes('data: hello')); });
test('client count', () => { const sse = createSSEEmitter(); sse.addClient(() => {}); sse.addClient(() => {}); assert.equal(sse.clientCount(), 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
