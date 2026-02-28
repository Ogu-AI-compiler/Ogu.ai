import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 358 — CORS Handler + Accept Resolver\x1b[0m\n');
console.log('\x1b[36m  Part 1: CORS Handler\x1b[0m');
test('cors-handler.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/cors-handler.mjs')));
const { createCORSHandler } = await import('../../tools/ogu/commands/lib/cors-handler.mjs');
test('wildcard allows all', () => { const cors = createCORSHandler(); assert.ok(cors.isAllowed('http://example.com')); });
test('specific origins', () => { const cors = createCORSHandler({ origins: ['http://a.com'] }); assert.ok(cors.isAllowed('http://a.com')); assert.ok(!cors.isAllowed('http://b.com')); });
test('get headers', () => { const cors = createCORSHandler(); const h = cors.getHeaders('http://x.com'); assert.ok(h['Access-Control-Allow-Origin']); });
test('add origin', () => { const cors = createCORSHandler({ origins: ['http://a.com'] }); cors.addOrigin('http://b.com'); assert.ok(cors.isAllowed('http://b.com')); });

console.log('\n\x1b[36m  Part 2: Accept Resolver\x1b[0m');
test('accept-resolver.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/accept-resolver.mjs')));
const { createAcceptResolver } = await import('../../tools/ogu/commands/lib/accept-resolver.mjs');
test('resolve type', () => { const ar = createAcceptResolver(['application/json', 'text/html']); assert.equal(ar.resolve('application/json, text/html;q=0.9'), 'application/json'); });
test('wildcard', () => { const ar = createAcceptResolver(['text/plain']); assert.equal(ar.resolve('*/*'), 'text/plain'); });
test('no match', () => { const ar = createAcceptResolver(['text/html']); assert.equal(ar.resolve('application/xml'), null); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
