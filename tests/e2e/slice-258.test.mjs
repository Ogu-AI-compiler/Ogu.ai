import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 258 — Actor Model + Mailbox\x1b[0m\n');

console.log('\x1b[36m  Part 1: Actor Model\x1b[0m');
test('actor-model.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/actor-model.mjs'));
});

const { createActorSystem } = await import('../../tools/ogu/commands/lib/actor-model.mjs');

test('spawn actor and send message', () => {
  const sys = createActorSystem();
  const received = [];
  sys.spawn('greeter', (msg) => { received.push(msg); });
  sys.send('greeter', { text: 'hello' });
  sys.tick();
  assert.equal(received.length, 1);
  assert.equal(received[0].text, 'hello');
});

test('list actors', () => {
  const sys = createActorSystem();
  sys.spawn('a', () => {});
  sys.spawn('b', () => {});
  assert.equal(sys.list().length, 2);
});

console.log('\n\x1b[36m  Part 2: Mailbox\x1b[0m');
test('mailbox.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/mailbox.mjs'));
});

const { createMailbox } = await import('../../tools/ogu/commands/lib/mailbox.mjs');

test('deliver and read messages', () => {
  const mb = createMailbox();
  mb.deliver({ from: 'a', body: 'hi' });
  mb.deliver({ from: 'b', body: 'yo' });
  assert.equal(mb.read().body, 'hi');
  assert.equal(mb.pending(), 1);
});

test('empty mailbox returns null', () => {
  const mb = createMailbox();
  assert.equal(mb.read(), null);
});

test('peek does not remove', () => {
  const mb = createMailbox();
  mb.deliver({ body: 'test' });
  mb.peek();
  assert.equal(mb.pending(), 1);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
