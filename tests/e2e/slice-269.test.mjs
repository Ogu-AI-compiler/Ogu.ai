import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 269 — String Template + String Context\x1b[0m\n');

console.log('\x1b[36m  Part 1: String Template\x1b[0m');
test('string-template.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/string-template.mjs'));
});

const { render } = await import('../../tools/ogu/commands/lib/string-template.mjs');

test('render simple template', () => {
  assert.equal(render('Hello {{name}}!', { name: 'World' }), 'Hello World!');
});

test('render multiple vars', () => {
  assert.equal(render('{{a}} + {{b}} = {{c}}', { a: 1, b: 2, c: 3 }), '1 + 2 = 3');
});

test('missing var left as-is', () => {
  assert.equal(render('Hi {{x}}', {}), 'Hi {{x}}');
});

console.log('\n\x1b[36m  Part 2: String Context\x1b[0m');
test('string-context.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/string-context.mjs'));
});

const { createStringContext } = await import('../../tools/ogu/commands/lib/string-context.mjs');

test('set and get context vars', () => {
  const ctx = createStringContext();
  ctx.set('name', 'Alice');
  assert.equal(ctx.get('name'), 'Alice');
});

test('resolve with context', () => {
  const ctx = createStringContext();
  ctx.set('greeting', 'Hello');
  ctx.set('name', 'Bob');
  assert.equal(ctx.resolve('{{greeting}} {{name}}'), 'Hello Bob');
});

test('list keys', () => {
  const ctx = createStringContext();
  ctx.set('a', 1); ctx.set('b', 2);
  assert.equal(ctx.keys().length, 2);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
