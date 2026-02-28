import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 357 — Response Builder + Route Pipeline\x1b[0m\n');
console.log('\x1b[36m  Part 1: Response Builder\x1b[0m');
test('response-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/response-builder.mjs')));
const { createResponseBuilder } = await import('../../tools/ogu/commands/lib/response-builder.mjs');
test('build json response', () => { const res = createResponseBuilder().status(200).json({ ok: true }).build(); assert.equal(res.status, 200); assert.equal(res.headers['Content-Type'], 'application/json'); });
test('build text response', () => { const res = createResponseBuilder().text('hello').build(); assert.equal(res.body, 'hello'); });
test('custom headers', () => { const res = createResponseBuilder().header('X-Custom', 'val').build(); assert.equal(res.headers['X-Custom'], 'val'); });

console.log('\n\x1b[36m  Part 2: Route Pipeline\x1b[0m');
test('route-pipeline.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/route-pipeline.mjs')));
const { createRoutePipeline } = await import('../../tools/ogu/commands/lib/route-pipeline.mjs');
test('execute pipeline', () => { const rp = createRoutePipeline(); rp.use((ctx, next) => { ctx.a = 1; next(); }); rp.use((ctx, next) => { ctx.b = 2; next(); }); const ctx = rp.execute({}); assert.equal(ctx.a, 1); assert.equal(ctx.b, 2); });
test('pipeline order', () => { const rp = createRoutePipeline(); const order = []; rp.use((_, next) => { order.push(1); next(); }); rp.use((_, next) => { order.push(2); next(); }); rp.execute({}); assert.deepEqual(order, [1, 2]); });
test('count and clear', () => { const rp = createRoutePipeline(); rp.use(() => {}); assert.equal(rp.count(), 1); rp.clear(); assert.equal(rp.count(), 0); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
