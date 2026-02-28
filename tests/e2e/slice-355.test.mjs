import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 355 — URL Parser + Query String Builder\x1b[0m\n');
console.log('\x1b[36m  Part 1: URL Parser\x1b[0m');
test('url-parser.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/url-parser.mjs')));
const { parseURL } = await import('../../tools/ogu/commands/lib/url-parser.mjs');
test('parse full URL', () => { const r = parseURL('https://example.com:8080/path?key=val#hash'); assert.equal(r.protocol, 'https'); assert.equal(r.host, 'example.com'); assert.equal(r.port, 8080); assert.equal(r.path, '/path'); assert.equal(r.query.key, 'val'); });
test('parse simple URL', () => { const r = parseURL('http://localhost/api'); assert.equal(r.host, 'localhost'); assert.equal(r.port, null); });
test('invalid URL', () => { assert.equal(parseURL('not-a-url'), null); });

console.log('\n\x1b[36m  Part 2: Query String Builder\x1b[0m');
test('query-string-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/query-string-builder.mjs')));
const { buildQueryString, parseQueryString, appendParam } = await import('../../tools/ogu/commands/lib/query-string-builder.mjs');
test('build query string', () => { assert.equal(buildQueryString({ a: '1', b: '2' }), 'a=1&b=2'); });
test('parse query string', () => { const r = parseQueryString('?a=1&b=2'); assert.equal(r.a, '1'); assert.equal(r.b, '2'); });
test('append param', () => { const r = appendParam('/api?a=1', 'b', '2'); assert.ok(r.includes('b=2')); });
test('skip null/undefined', () => { assert.equal(buildQueryString({ a: '1', b: null, c: undefined }), 'a=1'); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
