import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 335 — Spell Checker + Dictionary Store\x1b[0m\n');
console.log('\x1b[36m  Part 1: Spell Checker\x1b[0m');
test('spell-checker.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/spell-checker.mjs')));
const { createSpellChecker } = await import('../../tools/ogu/commands/lib/spell-checker.mjs');
test('check correct word', () => { const sc = createSpellChecker(['hello', 'world']); assert.ok(sc.check('hello')); });
test('check incorrect word', () => { const sc = createSpellChecker(['hello']); assert.ok(!sc.check('helo')); });
test('suggest corrections', () => { const sc = createSpellChecker(['hello', 'world', 'help']); const s = sc.suggest('helo'); assert.ok(s.includes('hello')); });
test('add word', () => { const sc = createSpellChecker([]); sc.addWord('custom'); assert.ok(sc.check('custom')); });
test('size', () => { const sc = createSpellChecker(['a', 'b', 'c']); assert.equal(sc.size(), 3); });

console.log('\n\x1b[36m  Part 2: Dictionary Store\x1b[0m');
test('dictionary-store.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/dictionary-store.mjs')));
const { createDictionaryStore } = await import('../../tools/ogu/commands/lib/dictionary-store.mjs');
test('define and lookup', () => { const ds = createDictionaryStore(); ds.define('hello', 'a greeting', 'interjection'); const defs = ds.lookup('hello'); assert.equal(defs[0].definition, 'a greeting'); });
test('multiple definitions', () => { const ds = createDictionaryStore(); ds.define('run', 'to move quickly', 'verb'); ds.define('run', 'a trip', 'noun'); assert.equal(ds.lookup('run').length, 2); });
test('has word', () => { const ds = createDictionaryStore(); ds.define('yes', 'affirmative'); assert.ok(ds.has('yes')); assert.ok(!ds.has('no')); });
test('list and count', () => { const ds = createDictionaryStore(); ds.define('a', 'x'); ds.define('b', 'y'); assert.equal(ds.count(), 2); assert.deepEqual(ds.listWords(), ['a', 'b']); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
