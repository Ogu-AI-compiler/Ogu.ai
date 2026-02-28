import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 257 — Channel + Select Multiplexer\x1b[0m\n');

console.log('\x1b[36m  Part 1: Channel\x1b[0m');
test('channel.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/channel.mjs'));
});

const { createChannel } = await import('../../tools/ogu/commands/lib/channel.mjs');

test('send and receive', () => {
  const ch = createChannel();
  ch.send('hello');
  assert.equal(ch.receive(), 'hello');
});

test('empty receive returns null', () => {
  const ch = createChannel();
  assert.equal(ch.receive(), null);
});

test('close prevents new sends', () => {
  const ch = createChannel();
  ch.close();
  assert.ok(!ch.send('x'));
});

console.log('\n\x1b[36m  Part 2: Select Multiplexer\x1b[0m');
test('select-multiplexer.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/select-multiplexer.mjs'));
});

const { createSelectMultiplexer } = await import('../../tools/ogu/commands/lib/select-multiplexer.mjs');

test('select returns first ready channel', () => {
  const ch1 = createChannel();
  const ch2 = createChannel();
  ch2.send('data');
  const mux = createSelectMultiplexer();
  mux.addChannel('ch1', ch1);
  mux.addChannel('ch2', ch2);
  const result = mux.select();
  assert.equal(result.name, 'ch2');
  assert.equal(result.value, 'data');
});

test('select returns null when no data', () => {
  const mux = createSelectMultiplexer();
  mux.addChannel('empty', createChannel());
  assert.equal(mux.select(), null);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
