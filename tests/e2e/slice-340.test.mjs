import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 340 — Code Minifier + Source Mapper\x1b[0m\n');
console.log('\x1b[36m  Part 1: Code Minifier\x1b[0m');
test('code-minifier.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/code-minifier.mjs')));
const { createCodeMinifier } = await import('../../tools/ogu/commands/lib/code-minifier.mjs');
const cm = createCodeMinifier();
test('remove comments', () => { assert.equal(cm.removeComments('x = 1; // comment'), 'x = 1; '); });
test('remove block comments', () => { assert.equal(cm.removeComments('a /* block */ b'), 'a  b'); });
test('collapse whitespace', () => { assert.equal(cm.collapseWhitespace('  a   b  c  '), 'a b c'); });
test('custom transforms', () => { cm.addTransform('upper', s => s.toUpperCase()); assert.equal(cm.minify('hello'), 'HELLO'); });

console.log('\n\x1b[36m  Part 2: Source Mapper\x1b[0m');
test('source-mapper.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/source-mapper.mjs')));
const { createSourceMapper } = await import('../../tools/ogu/commands/lib/source-mapper.mjs');
test('add and get source', () => { const sm = createSourceMapper(); sm.addMapping({ line: 1, col: 0 }, { line: 5, col: 3 }); const s = sm.getSource(1, 0); assert.deepEqual(s, { line: 5, col: 3 }); });
test('get generated', () => { const sm = createSourceMapper(); sm.addMapping({ line: 1, col: 0 }, { line: 5, col: 3 }); const g = sm.getGenerated(5, 3); assert.deepEqual(g, { line: 1, col: 0 }); });
test('count mappings', () => { const sm = createSourceMapper(); sm.addMapping({ line: 1, col: 0 }, { line: 1, col: 0 }); sm.addMapping({ line: 2, col: 0 }, { line: 3, col: 0 }); assert.equal(sm.count(), 2); });
test('null for unmapped', () => { const sm = createSourceMapper(); assert.equal(sm.getSource(99, 99), null); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
