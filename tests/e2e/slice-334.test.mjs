import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 334 — Autocomplete Engine + Suggestion Ranker\x1b[0m\n');
console.log('\x1b[36m  Part 1: Autocomplete Engine\x1b[0m');
test('autocomplete-engine.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/autocomplete-engine.mjs')));
const { createAutocompleteEngine } = await import('../../tools/ogu/commands/lib/autocomplete-engine.mjs');
test('suggest by prefix', () => { const ac = createAutocompleteEngine(); ac.add('apple', 5); ac.add('application', 3); ac.add('banana', 1); const r = ac.suggest('app'); assert.deepEqual(r, ['apple', 'application']); });
test('weight ordering', () => { const ac = createAutocompleteEngine(); ac.add('abc', 1); ac.add('abd', 10); const r = ac.suggest('ab'); assert.equal(r[0], 'abd'); });
test('limit results', () => { const ac = createAutocompleteEngine(); for (let i = 0; i < 20; i++) ac.add(`item${i}`); assert.equal(ac.suggest('item', 3).length, 3); });
test('remove entry', () => { const ac = createAutocompleteEngine(); ac.add('test'); ac.remove('test'); assert.equal(ac.suggest('test').length, 0); });

console.log('\n\x1b[36m  Part 2: Suggestion Ranker\x1b[0m');
test('suggestion-ranker.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/suggestion-ranker.mjs')));
const { createSuggestionRanker } = await import('../../tools/ogu/commands/lib/suggestion-ranker.mjs');
test('rank by single criterion', () => { const sr = createSuggestionRanker(); sr.addCriterion('length', item => item.length); const r = sr.rank(['ab', 'abcd', 'a']); assert.equal(r[0].item, 'abcd'); });
test('weighted criteria', () => { const sr = createSuggestionRanker(); sr.addCriterion('val', item => item.val, 2); sr.addCriterion('pop', item => item.pop, 1); const r = sr.rank([{ val: 1, pop: 3 }, { val: 5, pop: 1 }]); assert.equal(r[0].item.val, 5); });
test('list criteria', () => { const sr = createSuggestionRanker(); sr.addCriterion('a', () => 0); sr.addCriterion('b', () => 0); assert.deepEqual(sr.listCriteria(), ['a', 'b']); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
