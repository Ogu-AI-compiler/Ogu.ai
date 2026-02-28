import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 346 — File Watcher + Directory Scanner\x1b[0m\n');
console.log('\x1b[36m  Part 1: File Watcher\x1b[0m');
test('file-watcher.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/file-watcher.mjs')));
const { createFileWatcher } = await import('../../tools/ogu/commands/lib/file-watcher.mjs');
test('watch and simulate', () => { const fw = createFileWatcher(); let got = null; fw.watch('/a.js', e => got = e); fw.simulate('/a.js', 'change'); assert.equal(got.event, 'change'); });
test('unwatch', () => { const fw = createFileWatcher(); const id = fw.watch('/b.js', () => {}); fw.unwatch(id); assert.equal(fw.count(), 0); });
test('count watchers', () => { const fw = createFileWatcher(); fw.watch('/a', () => {}); fw.watch('/b', () => {}); assert.equal(fw.count(), 2); });

console.log('\n\x1b[36m  Part 2: Directory Scanner\x1b[0m');
test('directory-scanner.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/directory-scanner.mjs')));
const { createDirectoryScanner } = await import('../../tools/ogu/commands/lib/directory-scanner.mjs');
test('scan entries', () => { const ds = createDirectoryScanner(); ds.addEntry('/src/a.js', 'file', 100); ds.addEntry('/src/b.js', 'file', 200); assert.equal(ds.scan('/src').length, 2); });
test('filter files only', () => { const ds = createDirectoryScanner(); ds.addEntry('/src', 'dir'); ds.addEntry('/src/a.js', 'file'); assert.equal(ds.files('/').length, 1); });
test('total size', () => { const ds = createDirectoryScanner(); ds.addEntry('/a', 'file', 100); ds.addEntry('/b', 'file', 200); assert.equal(ds.totalSize('/'), 300); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
