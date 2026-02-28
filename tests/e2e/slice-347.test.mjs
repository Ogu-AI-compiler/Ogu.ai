import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 347 — Pattern Glob + Path Resolver\x1b[0m\n');
console.log('\x1b[36m  Part 1: Pattern Glob\x1b[0m');
test('pattern-glob.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/pattern-glob.mjs')));
const { matchGlob, filterGlob, createGlobMatcher } = await import('../../tools/ogu/commands/lib/pattern-glob.mjs');
test('match simple glob', () => { assert.ok(matchGlob('*.js', 'app.js')); assert.ok(!matchGlob('*.js', 'app.ts')); });
test('match double star', () => { assert.ok(matchGlob('src/**/*.js', 'src/lib/utils.js')); });
test('filter glob', () => { const r = filterGlob('*.js', ['a.js', 'b.ts', 'c.js']); assert.deepEqual(r, ['a.js', 'c.js']); });
test('glob matcher', () => { const gm = createGlobMatcher(['*.js', '*.ts']); assert.ok(gm.match('app.js')); assert.ok(gm.match('app.ts')); assert.ok(!gm.match('app.py')); });

console.log('\n\x1b[36m  Part 2: Path Resolver\x1b[0m');
test('path-resolver.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/path-resolver.mjs')));
const { resolve, join, dirname, basename, extname } = await import('../../tools/ogu/commands/lib/path-resolver.mjs');
test('resolve path', () => { assert.equal(resolve('/src', 'lib', '..', 'utils'), '/src/utils'); });
test('join paths', () => { assert.equal(join('src', 'lib', 'utils.js'), 'src/lib/utils.js'); });
test('dirname', () => { assert.equal(dirname('/src/lib/utils.js'), '/src/lib'); });
test('basename', () => { assert.equal(basename('/src/utils.js'), 'utils.js'); assert.equal(basename('/src/utils.js', '.js'), 'utils'); });
test('extname', () => { assert.equal(extname('file.txt'), '.txt'); assert.equal(extname('noext'), ''); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
