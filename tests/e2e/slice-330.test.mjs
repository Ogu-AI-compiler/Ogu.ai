import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 330 — Clipboard Manager + Paste Handler\x1b[0m\n');
console.log('\x1b[36m  Part 1: Clipboard Manager\x1b[0m');
test('clipboard-manager.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/clipboard-manager.mjs')));
const { createClipboardManager } = await import('../../tools/ogu/commands/lib/clipboard-manager.mjs');
test('copy and paste', () => { const cm = createClipboardManager(); cm.copy('hello'); assert.equal(cm.paste(), 'hello'); });
test('named slots', () => { const cm = createClipboardManager(); cm.copy('a', 'slot1'); cm.copy('b', 'slot2'); assert.equal(cm.paste('slot1'), 'a'); assert.equal(cm.paste('slot2'), 'b'); });
test('clear slot', () => { const cm = createClipboardManager(); cm.copy('x'); cm.clear(); assert.equal(cm.paste(), null); });
test('list slots', () => { const cm = createClipboardManager(); cm.copy('a', 's1'); cm.copy('b', 's2'); assert.equal(cm.listSlots().length, 2); });
test('history', () => { const cm = createClipboardManager(); cm.copy('a'); cm.copy('b'); assert.equal(cm.getHistory().length, 2); });

console.log('\n\x1b[36m  Part 2: Paste Handler\x1b[0m');
test('paste-handler.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/paste-handler.mjs')));
const { createPasteHandler } = await import('../../tools/ogu/commands/lib/paste-handler.mjs');
test('process with transformers', () => { const ph = createPasteHandler(); ph.addTransformer('trim', s => s.trim()); ph.addTransformer('upper', s => s.toUpperCase()); assert.equal(ph.process('  hello  '), 'HELLO'); });
test('remove transformer', () => { const ph = createPasteHandler(); ph.addTransformer('trim', s => s.trim()); ph.removeTransformer('trim'); assert.equal(ph.process('  x  '), '  x  '); });
test('no transformers passthrough', () => { const ph = createPasteHandler(); assert.equal(ph.process('raw'), 'raw'); });
test('list transformers', () => { const ph = createPasteHandler(); ph.addTransformer('a', s => s); ph.addTransformer('b', s => s); assert.deepEqual(ph.listTransformers(), ['a', 'b']); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
