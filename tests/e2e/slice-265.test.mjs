import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
  catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); }
}

console.log('\x1b[1mSlice 265 — Plugin Registry\x1b[0m\n');

console.log('\x1b[36m  Part 1: Plugin Registry\x1b[0m');
test('plugin-registry.mjs exists', () => {
  assert.ok(existsSync('tools/ogu/commands/lib/plugin-registry.mjs'));
});

const { createPluginRegistry } = await import('../../tools/ogu/commands/lib/plugin-registry.mjs');

test('register and get plugin', () => {
  const pr = createPluginRegistry();
  pr.register('logger', { log: (msg) => msg });
  const plugin = pr.get('logger');
  assert.equal(plugin.log('hi'), 'hi');
});

test('list plugins', () => {
  const pr = createPluginRegistry();
  pr.register('a', {}); pr.register('b', {});
  assert.equal(pr.list().length, 2);
});

test('unregister removes plugin', () => {
  const pr = createPluginRegistry();
  pr.register('temp', {});
  pr.unregister('temp');
  assert.equal(pr.get('temp'), null);
});

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
