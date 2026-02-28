import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 343 — Semver Parser + Version Comparator\x1b[0m\n');
console.log('\x1b[36m  Part 1: Semver Parser\x1b[0m');
test('semver-parser.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/semver-parser.mjs')));
const { parse, stringify, bump, isValid } = await import('../../tools/ogu/commands/lib/semver-parser.mjs');
test('parse version', () => { const v = parse('1.2.3'); assert.deepEqual(v, { major: 1, minor: 2, patch: 3, prerelease: null }); });
test('parse with prerelease', () => { const v = parse('1.0.0-beta'); assert.equal(v.prerelease, 'beta'); });
test('bump major', () => { const v = bump('1.2.3', 'major'); assert.equal(v.major, 2); assert.equal(v.minor, 0); });
test('stringify', () => { assert.equal(stringify({ major: 1, minor: 2, patch: 3, prerelease: null }), '1.2.3'); });
test('isValid', () => { assert.ok(isValid('1.2.3')); assert.ok(!isValid('not-a-version')); });

console.log('\n\x1b[36m  Part 2: Version Comparator\x1b[0m');
test('version-comparator.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/version-comparator.mjs')));
const { compare, gt, lt, eq, sort } = await import('../../tools/ogu/commands/lib/version-comparator.mjs');
test('compare versions', () => { assert.equal(compare('1.0.0', '2.0.0'), -1); assert.equal(compare('2.0.0', '1.0.0'), 1); assert.equal(compare('1.0.0', '1.0.0'), 0); });
test('gt/lt/eq', () => { assert.ok(gt('2.0.0', '1.0.0')); assert.ok(lt('1.0.0', '2.0.0')); assert.ok(eq('1.0.0', '1.0.0')); });
test('sort versions', () => { assert.deepEqual(sort(['2.0.0', '1.0.0', '1.5.0']), ['1.0.0', '1.5.0', '2.0.0']); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
