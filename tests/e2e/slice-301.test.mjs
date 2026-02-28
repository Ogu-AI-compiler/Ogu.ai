import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 301 — Time Series Analyzer + Moving Average\x1b[0m\n');
console.log('\x1b[36m  Part 1: Time Series Analyzer\x1b[0m');
test('time-series-analyzer.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/time-series-analyzer.mjs')));
const { createTimeSeriesAnalyzer } = await import('../../tools/ogu/commands/lib/time-series-analyzer.mjs');
test('detect trend', () => { const ts = createTimeSeriesAnalyzer(); ts.addAll([1,2,3,4,5]); assert.equal(ts.trend(), 'up'); });
test('detect flat', () => { const ts = createTimeSeriesAnalyzer(); ts.addAll([3,3,3,3]); assert.equal(ts.trend(), 'flat'); });

console.log('\n\x1b[36m  Part 2: Moving Average\x1b[0m');
test('moving-average.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/moving-average.mjs')));
const { simpleMovingAverage, exponentialMovingAverage } = await import('../../tools/ogu/commands/lib/moving-average.mjs');
test('SMA window 3', () => { const r = simpleMovingAverage([1,2,3,4,5], 3); assert.equal(r.length, 3); assert.equal(r[0], 2); });
test('EMA calculation', () => { const r = exponentialMovingAverage([1,2,3,4,5], 0.5); assert.equal(r.length, 5); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
