import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 321 — Feature Flag + Config Loader\x1b[0m\n');
console.log('\x1b[36m  Part 1: Feature Flag\x1b[0m');
test('feature-flag.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/feature-flag.mjs')));
const { createFeatureFlags } = await import('../../tools/ogu/commands/lib/feature-flag.mjs');
test('set and check flag', () => { const ff = createFeatureFlags(); ff.set('dark-mode', true); assert.ok(ff.isEnabled('dark-mode')); });
test('disabled flag', () => { const ff = createFeatureFlags(); ff.set('beta', false); assert.ok(!ff.isEnabled('beta')); });
test('conditional flag', () => { const ff = createFeatureFlags(); ff.set('admin-panel', true, ctx => ctx.role === 'admin'); assert.ok(ff.isEnabled('admin-panel', { role: 'admin' })); assert.ok(!ff.isEnabled('admin-panel', { role: 'user' })); });
test('toggle flag', () => { const ff = createFeatureFlags(); ff.set('x', true); ff.toggle('x'); assert.ok(!ff.isEnabled('x')); });
test('list flags', () => { const ff = createFeatureFlags(); ff.set('a', true); ff.set('b', false); assert.equal(ff.list().length, 2); });

console.log('\n\x1b[36m  Part 2: Config Loader\x1b[0m');
test('config-loader.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/config-loader.mjs')));
const { createConfigLoader } = await import('../../tools/ogu/commands/lib/config-loader.mjs');
test('load and get config', () => { const cl = createConfigLoader(); cl.addSource('default', { port: 3000 }); assert.equal(cl.get('port'), 3000); });
test('priority merge', () => { const cl = createConfigLoader(); cl.addSource('default', { port: 3000 }, 0); cl.addSource('env', { port: 8080 }, 1); assert.equal(cl.get('port'), 8080); });
test('default value', () => { const cl = createConfigLoader(); assert.equal(cl.get('missing', 42), 42); });
test('list sources', () => { const cl = createConfigLoader(); cl.addSource('a', {}); cl.addSource('b', {}); assert.equal(cl.listSources().length, 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
