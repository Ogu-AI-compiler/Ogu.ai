import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 336 — Syntax Highlighter + Token Classifier\x1b[0m\n');
console.log('\x1b[36m  Part 1: Syntax Highlighter\x1b[0m');
test('syntax-highlighter.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/syntax-highlighter.mjs')));
const { createSyntaxHighlighter } = await import('../../tools/ogu/commands/lib/syntax-highlighter.mjs');
test('highlight keywords', () => { const sh = createSyntaxHighlighter(); sh.addRule('keyword', '\\b(if|else|for)\\b'); const t = sh.highlight('if (x) else y'); assert.ok(t.some(tk => tk.type === 'keyword' && tk.value === 'if')); });
test('highlight numbers', () => { const sh = createSyntaxHighlighter(); sh.addRule('number', '\\d+'); const t = sh.highlight('x = 42'); assert.ok(t.some(tk => tk.type === 'number' && tk.value === '42')); });
test('list rules', () => { const sh = createSyntaxHighlighter(); sh.addRule('a', 'x'); sh.addRule('b', 'y'); assert.deepEqual(sh.listRules(), ['a', 'b']); });

console.log('\n\x1b[36m  Part 2: Token Classifier\x1b[0m');
test('token-classifier.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/token-classifier.mjs')));
const { createTokenClassifier } = await import('../../tools/ogu/commands/lib/token-classifier.mjs');
test('classify token', () => { const tc = createTokenClassifier(); tc.register('number', t => /^\d+$/.test(t.value)); tc.register('word', t => /^[a-z]+$/i.test(t.value)); assert.equal(tc.classify({ value: '42' }), 'number'); });
test('unknown type', () => { const tc = createTokenClassifier(); assert.equal(tc.classify({ value: '@' }), 'unknown'); });
test('classify all', () => { const tc = createTokenClassifier(); tc.register('num', t => /^\d+$/.test(t.value)); const r = tc.classifyAll([{ value: '1' }, { value: 'a' }]); assert.equal(r[0].classification, 'num'); assert.equal(r[1].classification, 'unknown'); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
