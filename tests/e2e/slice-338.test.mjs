import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 338 — Code Formatter + Indentation Engine\x1b[0m\n');
console.log('\x1b[36m  Part 1: Code Formatter\x1b[0m');
test('code-formatter.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/code-formatter.mjs')));
const { createCodeFormatter } = await import('../../tools/ogu/commands/lib/code-formatter.mjs');
test('format with rule', () => { const cf = createCodeFormatter(); cf.addRule('trim', s => s.trim()); assert.equal(cf.format('  hello  '), 'hello'); });
test('format lines trims trailing', () => { const cf = createCodeFormatter(); assert.equal(cf.formatLines('x  \ny  '), 'x\ny'); });
test('get indent', () => { const cf = createCodeFormatter({ indent: '\t' }); assert.equal(cf.getIndent(), '\t'); });
test('list rules', () => { const cf = createCodeFormatter(); cf.addRule('a', s => s); cf.addRule('b', s => s); assert.deepEqual(cf.listRules(), ['a', 'b']); });

console.log('\n\x1b[36m  Part 2: Indentation Engine\x1b[0m');
test('indentation-engine.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/indentation-engine.mjs')));
const { createIndentationEngine } = await import('../../tools/ogu/commands/lib/indentation-engine.mjs');
test('indent and dedent', () => { const ie = createIndentationEngine('  '); ie.indent(); ie.indent(); assert.equal(ie.getLevel(), 2); ie.dedent(); assert.equal(ie.getLevel(), 1); });
test('get prefix', () => { const ie = createIndentationEngine('--'); ie.indent(); ie.indent(); assert.equal(ie.getPrefix(), '----'); });
test('indent line', () => { const ie = createIndentationEngine('  '); ie.indent(); assert.equal(ie.indentLine('x'), '  x'); });
test('indent block', () => { const ie = createIndentationEngine('  '); ie.indent(); const r = ie.indentBlock(['a', 'b']); assert.deepEqual(r, ['  a', '  b']); });
test('reset', () => { const ie = createIndentationEngine('  '); ie.indent(); ie.indent(); ie.reset(); assert.equal(ie.getLevel(), 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
