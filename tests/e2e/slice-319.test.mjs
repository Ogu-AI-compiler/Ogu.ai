import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 319 — Health Checker + Heartbeat Monitor\x1b[0m\n');
console.log('\x1b[36m  Part 1: Health Checker\x1b[0m');
test('health-checker.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/health-checker.mjs')));
const { createHealthChecker } = await import('../../tools/ogu/commands/lib/health-checker.mjs');
test('all healthy', () => { const hc = createHealthChecker(); hc.register('db', () => true); hc.register('cache', () => true); const r = hc.run(); assert.ok(r.healthy); });
test('detect unhealthy', () => { const hc = createHealthChecker(); hc.register('db', () => true); hc.register('cache', () => { throw new Error('down'); }); const r = hc.run(); assert.ok(!r.healthy); assert.equal(r.checks.cache.error, 'down'); });
test('unregister check', () => { const hc = createHealthChecker(); hc.register('x', () => true); hc.unregister('x'); assert.equal(hc.list().length, 0); });
test('list checks', () => { const hc = createHealthChecker(); hc.register('a', () => true); hc.register('b', () => true); assert.deepEqual(hc.list(), ['a', 'b']); });

console.log('\n\x1b[36m  Part 2: Heartbeat Monitor\x1b[0m');
test('heartbeat-monitor.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/heartbeat-monitor.mjs')));
const { createHeartbeatMonitor } = await import('../../tools/ogu/commands/lib/heartbeat-monitor.mjs');
test('register and beat', () => { const hm = createHeartbeatMonitor(1000); hm.register('svc1'); hm.beat('svc1', 100); assert.ok(hm.isAlive('svc1', 500)); });
test('detect timeout', () => { const hm = createHeartbeatMonitor(100); hm.register('svc1'); hm.beat('svc1', 100); assert.ok(!hm.isAlive('svc1', 300)); });
test('check all services', () => { const hm = createHeartbeatMonitor(1000); hm.register('a'); hm.register('b'); hm.beat('a', 100); hm.beat('b', 100); const r = hm.check(500); assert.ok(r.a); assert.ok(r.b); });
test('list services', () => { const hm = createHeartbeatMonitor(1000); hm.register('x'); hm.register('y'); assert.deepEqual(hm.list(), ['x', 'y']); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
