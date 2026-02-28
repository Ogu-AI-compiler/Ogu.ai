import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 341 — Dependency Graph Builder + Graph Cycle Finder\x1b[0m\n');
console.log('\x1b[36m  Part 1: Dependency Graph Builder\x1b[0m');
test('dependency-graph-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/dependency-graph-builder.mjs')));
const { createDependencyGraphBuilder } = await import('../../tools/ogu/commands/lib/dependency-graph-builder.mjs');
test('add nodes and deps', () => { const dg = createDependencyGraphBuilder(); dg.addDependency('A', 'B'); dg.addDependency('A', 'C'); assert.deepEqual(dg.getDependencies('A'), ['B', 'C']); });
test('get dependents', () => { const dg = createDependencyGraphBuilder(); dg.addDependency('A', 'B'); dg.addDependency('C', 'B'); assert.deepEqual(dg.getDependents('B').sort(), ['A', 'C']); });
test('adjacency list', () => { const dg = createDependencyGraphBuilder(); dg.addDependency('X', 'Y'); const adj = dg.toAdjacencyList(); assert.ok(adj.X.includes('Y')); });
test('get nodes', () => { const dg = createDependencyGraphBuilder(); dg.addNode('A'); dg.addNode('B'); assert.equal(dg.getNodes().length, 2); });

console.log('\n\x1b[36m  Part 2: Graph Cycle Finder\x1b[0m');
test('graph-cycle-finder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/graph-cycle-finder.mjs')));
const { findCycles, hasCycle } = await import('../../tools/ogu/commands/lib/graph-cycle-finder.mjs');
test('detect cycle', () => { assert.ok(hasCycle({ A: ['B'], B: ['C'], C: ['A'] })); });
test('no cycle', () => { assert.ok(!hasCycle({ A: ['B'], B: ['C'], C: [] })); });
test('find cycle path', () => { const c = findCycles({ A: ['B'], B: ['A'] }); assert.ok(c.length > 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
