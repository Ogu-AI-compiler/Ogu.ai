import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 302 — FFT Calculator + Signal Processor\x1b[0m\n');
console.log('\x1b[36m  Part 1: FFT Calculator\x1b[0m');
test('fft-calculator.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/fft-calculator.mjs')));
const { fft } = await import('../../tools/ogu/commands/lib/fft-calculator.mjs');
test('FFT of constant signal', () => { const r = fft([1,1,1,1]); assert.equal(r.length, 4); assert.ok(Math.abs(r[0].re - 4) < 0.01); });

console.log('\n\x1b[36m  Part 2: Signal Processor\x1b[0m');
test('signal-processor.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/signal-processor.mjs')));
const { createSignalProcessor } = await import('../../tools/ogu/commands/lib/signal-processor.mjs');
test('lowpass filter', () => { const sp = createSignalProcessor(); const r = sp.lowpass([10,0,10,0,10,0], 0.3); assert.equal(r.length, 6); });
test('amplify signal', () => { const sp = createSignalProcessor(); const r = sp.amplify([1,2,3], 2); assert.deepEqual(r, [2,4,6]); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
