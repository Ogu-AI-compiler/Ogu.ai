import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 293 — TF-IDF Calculator + Inverted Index\x1b[0m\n');
console.log('\x1b[36m  Part 1: TF-IDF Calculator\x1b[0m');
test('tf-idf-calculator.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/tf-idf-calculator.mjs')));
const { createTfIdf } = await import('../../tools/ogu/commands/lib/tf-idf-calculator.mjs');
test('compute tf-idf scores', () => { const tfidf = createTfIdf(); tfidf.addDocument(['the','cat','sat']); tfidf.addDocument(['the','dog','ran']); const scores = tfidf.scores(0); assert.ok(scores.cat > 0); });

console.log('\n\x1b[36m  Part 2: Inverted Index\x1b[0m');
test('inverted-index.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/inverted-index.mjs')));
const { createInvertedIndex } = await import('../../tools/ogu/commands/lib/inverted-index.mjs');
test('index and search', () => { const idx = createInvertedIndex(); idx.addDocument(0, ['hello','world']); idx.addDocument(1, ['hello','there']); const r = idx.search('hello'); assert.deepEqual(r, [0, 1]); });
test('search missing returns empty', () => { const idx = createInvertedIndex(); assert.deepEqual(idx.search('nope'), []); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
