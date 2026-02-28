import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 312 — Signal Dispatcher + IPC Channel\x1b[0m\n');
console.log('\x1b[36m  Part 1: Signal Dispatcher\x1b[0m');
test('signal-dispatcher.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/signal-dispatcher.mjs')));
const { createSignalDispatcher } = await import('../../tools/ogu/commands/lib/signal-dispatcher.mjs');
test('dispatch signal', () => { const sd = createSignalDispatcher(); let v = 0; sd.on('SIGINT', () => v = 1); sd.dispatch('SIGINT'); assert.equal(v, 1); });
test('multiple handlers', () => { const sd = createSignalDispatcher(); const r = []; sd.on('SIG', () => r.push(1)); sd.on('SIG', () => r.push(2)); sd.dispatch('SIG'); assert.deepEqual(r, [1, 2]); });
test('history tracking', () => { const sd = createSignalDispatcher(); sd.on('X', () => {}); sd.dispatch('X', { a: 1 }); assert.equal(sd.getHistory().length, 1); });
test('off removes handlers', () => { const sd = createSignalDispatcher(); sd.on('Y', () => {}); sd.off('Y'); assert.ok(!sd.listSignals().includes('Y')); });

console.log('\n\x1b[36m  Part 2: IPC Channel\x1b[0m');
test('ipc-channel.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/ipc-channel.mjs')));
const { createIPCChannel } = await import('../../tools/ogu/commands/lib/ipc-channel.mjs');
test('send and receive', () => { const ch = createIPCChannel('ch1'); ch.send('hello'); assert.equal(ch.receive(), 'hello'); });
test('pending count', () => { const ch = createIPCChannel('ch2'); ch.send(1); ch.send(2); assert.equal(ch.pending(), 2); });
test('close channel', () => { const ch = createIPCChannel('ch3'); ch.close(); assert.ok(ch.isClosed()); assert.throws(() => ch.send('x')); });
test('onMessage listener', () => { const ch = createIPCChannel('ch4'); let got = null; ch.onMessage(m => got = m); ch.send('hi'); assert.equal(got, 'hi'); });
test('getName', () => { const ch = createIPCChannel('myChannel'); assert.equal(ch.getName(), 'myChannel'); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
