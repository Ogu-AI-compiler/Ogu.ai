import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 354 — XML Parser Simple + XML Builder\x1b[0m\n');
console.log('\x1b[36m  Part 1: XML Parser Simple\x1b[0m');
test('xml-parser-simple.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/xml-parser-simple.mjs')));
const { parseXML } = await import('../../tools/ogu/commands/lib/xml-parser-simple.mjs');
test('parse simple xml', () => { const r = parseXML('<root><name>hello</name></root>'); assert.equal(r[0].tag, 'root'); assert.equal(r[0].children[0].text, 'hello'); });
test('parse attributes', () => { const r = parseXML('<item id="1" type="a">text</item>'); assert.equal(r[0].attrs.id, '1'); });
test('nested elements', () => { const r = parseXML('<a><b><c>deep</c></b></a>'); assert.equal(r[0].children[0].children[0].text, 'deep'); });

console.log('\n\x1b[36m  Part 2: XML Builder\x1b[0m');
test('xml-builder.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/xml-builder.mjs')));
const { createXMLBuilder } = await import('../../tools/ogu/commands/lib/xml-builder.mjs');
test('build xml', () => { const xb = createXMLBuilder(); xb.open('root').text('hello').close('root'); const xml = xb.build(); assert.ok(xml.includes('<root>')); assert.ok(xml.includes('</root>')); });
test('attributes', () => { const xb = createXMLBuilder(); xb.open('item', { id: '1' }).close('item'); assert.ok(xb.build().includes('id="1"')); });
test('self closing', () => { const xb = createXMLBuilder(); xb.selfClose('br'); assert.ok(xb.build().includes('<br />')); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
