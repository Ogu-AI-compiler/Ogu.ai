import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 332 — Bookmark Store + Navigation History\x1b[0m\n');
console.log('\x1b[36m  Part 1: Bookmark Store\x1b[0m');
test('bookmark-store.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/bookmark-store.mjs')));
const { createBookmarkStore } = await import('../../tools/ogu/commands/lib/bookmark-store.mjs');
test('add and get', () => { const bs = createBookmarkStore(); bs.add('home', '/home', ['nav']); assert.equal(bs.get('home').location, '/home'); });
test('find by tag', () => { const bs = createBookmarkStore(); bs.add('a', '/a', ['x']); bs.add('b', '/b', ['y']); bs.add('c', '/c', ['x']); assert.equal(bs.findByTag('x').length, 2); });
test('remove bookmark', () => { const bs = createBookmarkStore(); bs.add('tmp', '/tmp'); bs.remove('tmp'); assert.equal(bs.get('tmp'), null); });
test('count', () => { const bs = createBookmarkStore(); bs.add('a', '/a'); bs.add('b', '/b'); assert.equal(bs.count(), 2); });

console.log('\n\x1b[36m  Part 2: Navigation History\x1b[0m');
test('navigation-history.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/navigation-history.mjs')));
const { createNavigationHistory } = await import('../../tools/ogu/commands/lib/navigation-history.mjs');
test('navigate and back', () => { const nh = createNavigationHistory(); nh.navigate('/a'); nh.navigate('/b'); nh.back(); assert.equal(nh.getCurrent(), '/a'); });
test('forward', () => { const nh = createNavigationHistory(); nh.navigate('/a'); nh.navigate('/b'); nh.back(); nh.forward(); assert.equal(nh.getCurrent(), '/b'); });
test('forward cleared on new navigate', () => { const nh = createNavigationHistory(); nh.navigate('/a'); nh.navigate('/b'); nh.back(); nh.navigate('/c'); assert.ok(!nh.canGoForward()); });
test('canGoBack/canGoForward', () => { const nh = createNavigationHistory(); nh.navigate('/a'); assert.ok(!nh.canGoBack()); nh.navigate('/b'); assert.ok(nh.canGoBack()); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
