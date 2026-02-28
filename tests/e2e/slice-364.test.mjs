import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 364 — Cron Parser + Cron Executor\x1b[0m\n');
console.log('\x1b[36m  Part 1: Cron Parser\x1b[0m');
test('cron-parser.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/cron-parser.mjs')));
const { parseCron, describeCron, isValidCron } = await import('../../tools/ogu/commands/lib/cron-parser.mjs');
test('parse cron expression', () => { const c = parseCron('0 12 * * 1'); assert.equal(c.minute, '0'); assert.equal(c.hour, '12'); assert.equal(c.dayOfWeek, '1'); });
test('describe cron', () => { const c = parseCron('30 9 * * *'); const desc = describeCron(c); assert.ok(desc.includes('30')); assert.ok(desc.includes('9')); });
test('isValid', () => { assert.ok(isValidCron('* * * * *')); assert.ok(!isValidCron('bad')); });

console.log('\n\x1b[36m  Part 2: Cron Executor\x1b[0m');
test('cron-executor.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/cron-executor.mjs')));
const { createCronExecutor } = await import('../../tools/ogu/commands/lib/cron-executor.mjs');
test('schedule and execute', () => { const ce = createCronExecutor(); const id = ce.schedule('cleanup', '0 * * * *', () => 'done'); assert.equal(ce.execute(id), 'done'); });
test('disable job', () => { const ce = createCronExecutor(); const id = ce.schedule('j', '* * * * *', () => 1); ce.disable(id); assert.equal(ce.execute(id), null); });
test('list jobs', () => { const ce = createCronExecutor(); ce.schedule('a', '* * * * *', () => {}); ce.schedule('b', '0 * * * *', () => {}); assert.equal(ce.list().length, 2); });
test('run count', () => { const ce = createCronExecutor(); const id = ce.schedule('j', '* * * * *', () => 1); ce.execute(id); ce.execute(id); assert.equal(ce.list().find(j => j.id === id).runs, 2); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
