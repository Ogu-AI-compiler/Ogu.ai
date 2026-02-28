import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 342 — Topological Sorter + Layer Resolver\x1b[0m\n');
console.log('\x1b[36m  Part 1: Topological Sorter\x1b[0m');
test('topological-sorter.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/topological-sorter.mjs')));
const { topologicalSort } = await import('../../tools/ogu/commands/lib/topological-sorter.mjs');
test('sort DAG', () => { const r = topologicalSort({ A: ['B', 'C'], B: ['C'], C: [] }); assert.ok(r.indexOf('A') < r.indexOf('B')); assert.ok(r.indexOf('B') < r.indexOf('C')); });
test('return null for cycle', () => { assert.equal(topologicalSort({ A: ['B'], B: ['A'] }), null); });
test('single node', () => { assert.deepEqual(topologicalSort({ A: [] }), ['A']); });

console.log('\n\x1b[36m  Part 2: Layer Resolver\x1b[0m');
test('layer-resolver.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/layer-resolver.mjs')));
const { createLayerResolver } = await import('../../tools/ogu/commands/lib/layer-resolver.mjs');
test('valid dependency', () => { const lr = createLayerResolver(); lr.addLayer('controller', ['service']); lr.addLayer('service', ['repo']); assert.ok(lr.canDepend('controller', 'service')); });
test('invalid dependency', () => { const lr = createLayerResolver(); lr.addLayer('service', ['repo']); assert.ok(!lr.canDepend('service', 'controller')); });
test('validate deps', () => { const lr = createLayerResolver(); lr.addLayer('A', ['B']); lr.addLayer('B', []); const r = lr.validate([{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }]); assert.ok(!r.valid); assert.equal(r.violations.length, 1); });
test('get layers', () => { const lr = createLayerResolver(); lr.addLayer('a', []); lr.addLayer('b', []); assert.deepEqual(lr.getLayers(), ['a', 'b']); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
