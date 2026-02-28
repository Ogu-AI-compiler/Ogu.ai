import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 356 — HTTP Router Simple + Request Builder\x1b[0m\n');
console.log('\x1b[36m  Part 1: HTTP Router Simple\x1b[0m');
test('http-router-simple.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/http-router-simple.mjs')));
const { createHTTPRouter } = await import('../../tools/ogu/commands/lib/http-router-simple.mjs');
test('register and dispatch', () => { const r = createHTTPRouter(); r.get('/api', () => ({ status: 200, body: 'ok' })); const res = r.dispatch('GET', '/api'); assert.equal(res.status, 200); });
test('404 for unknown route', () => { const r = createHTTPRouter(); const res = r.dispatch('GET', '/nope'); assert.equal(res.status, 404); });
test('list routes', () => { const r = createHTTPRouter(); r.get('/a', () => {}); r.post('/b', () => {}); assert.equal(r.listRoutes().length, 2); });

console.log('\n\x1b[36m  Part 2: Request Builder\x1b[0m');
test('request-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/request-builder.mjs')));
const { createRequestBuilder } = await import('../../tools/ogu/commands/lib/request-builder.mjs');
test('build request', () => { const req = createRequestBuilder().method('POST').url('/api').header('Content-Type', 'application/json').body('{}').build(); assert.equal(req.method, 'POST'); assert.equal(req.url, '/api'); });
test('query params', () => { const req = createRequestBuilder().query('page', '1').query('limit', '10').build(); assert.equal(req.query.page, '1'); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
