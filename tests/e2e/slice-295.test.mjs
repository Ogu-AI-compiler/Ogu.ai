import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 295 — Edit Distance Calculator + Longest Common Subsequence\x1b[0m\n');
console.log('\x1b[36m  Part 1: Edit Distance Calculator\x1b[0m');
test('edit-distance-calculator.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/edit-distance-calculator.mjs')));
const { editDistance } = await import('../../tools/ogu/commands/lib/edit-distance-calculator.mjs');
test('identical strings distance 0', () => assert.equal(editDistance('abc','abc'), 0));
test('kitten->sitting is 3', () => assert.equal(editDistance('kitten','sitting'), 3));

console.log('\n\x1b[36m  Part 2: Longest Common Subsequence\x1b[0m');
test('longest-common-subsequence.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/longest-common-subsequence.mjs')));
const { lcs } = await import('../../tools/ogu/commands/lib/longest-common-subsequence.mjs');
test('lcs of ABCBDAB and BDCAB is 4', () => assert.equal(lcs('ABCBDAB','BDCAB').length, 4));
test('lcs of empty string is 0', () => assert.equal(lcs('','abc').length, 0));

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
