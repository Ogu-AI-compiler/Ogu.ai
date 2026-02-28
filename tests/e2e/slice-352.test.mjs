import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 352 — Data Pipeline Builder + Transform Chain\x1b[0m\n');
console.log('\x1b[36m  Part 1: Data Pipeline Builder\x1b[0m');
test('data-pipeline-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/data-pipeline-builder.mjs')));
const { createDataPipelineBuilder } = await import('../../tools/ogu/commands/lib/data-pipeline-builder.mjs');
test('filter and map', () => { const p = createDataPipelineBuilder(); p.filter(x => x > 2).map(x => x * 10); assert.deepEqual(p.execute([1, 2, 3, 4]), [30, 40]); });
test('reduce', () => { const p = createDataPipelineBuilder(); p.reduce((a, b) => a + b, 0); assert.deepEqual(p.execute([1, 2, 3]), [6]); });
test('list steps', () => { const p = createDataPipelineBuilder(); p.filter(() => true).map(x => x); assert.deepEqual(p.listSteps(), ['filter', 'map']); });

console.log('\n\x1b[36m  Part 2: Transform Chain\x1b[0m');
test('transform-chain.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/transform-chain.mjs')));
const { createTransformChain } = await import('../../tools/ogu/commands/lib/transform-chain.mjs');
test('chain transforms', () => { const tc = createTransformChain(); tc.add('double', x => x * 2); tc.add('add1', x => x + 1); const { result } = tc.execute(5); assert.equal(result, 11); });
test('execution log', () => { const tc = createTransformChain(); tc.add('step1', x => x); const { log } = tc.execute(1); assert.equal(log[0].status, 'ok'); });
test('clear', () => { const tc = createTransformChain(); tc.add('a', x => x); tc.clear(); assert.equal(tc.listTransforms().length, 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
