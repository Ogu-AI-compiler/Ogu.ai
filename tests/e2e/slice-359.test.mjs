import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 359 — MIME Type Resolver + Cookie Jar\x1b[0m\n');
console.log('\x1b[36m  Part 1: MIME Type Resolver\x1b[0m');
test('mime-type-resolver.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/mime-type-resolver.mjs')));
const { createMimeTypeResolver } = await import('../../tools/ogu/commands/lib/mime-type-resolver.mjs');
test('resolve known type', () => { const mr = createMimeTypeResolver(); assert.equal(mr.resolve('.html'), 'text/html'); assert.equal(mr.resolve('.json'), 'application/json'); });
test('resolve unknown', () => { const mr = createMimeTypeResolver(); assert.equal(mr.resolve('.xyz'), 'application/octet-stream'); });
test('add custom type', () => { const mr = createMimeTypeResolver(); mr.add('.wasm', 'application/wasm'); assert.equal(mr.resolve('.wasm'), 'application/wasm'); });
test('get extension', () => { const mr = createMimeTypeResolver(); assert.equal(mr.getExtension('text/html'), '.html'); });

console.log('\n\x1b[36m  Part 2: Cookie Jar\x1b[0m');
test('cookie-jar.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/cookie-jar.mjs')));
const { createCookieJar } = await import('../../tools/ogu/commands/lib/cookie-jar.mjs');
test('set and get', () => { const cj = createCookieJar(); cj.set('session', 'abc123'); assert.equal(cj.get('session'), 'abc123'); });
test('remove cookie', () => { const cj = createCookieJar(); cj.set('x', 'y'); cj.remove('x'); assert.equal(cj.get('x'), null); });
test('serialize', () => { const cj = createCookieJar(); cj.set('a', '1'); cj.set('b', '2'); assert.ok(cj.serialize().includes('a=1')); });
test('parse cookies', () => { const cj = createCookieJar(); cj.parse('a=1; b=2'); assert.equal(cj.get('a'), '1'); assert.equal(cj.get('b'), '2'); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
