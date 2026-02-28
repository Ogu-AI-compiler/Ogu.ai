import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); } catch (e) { failed++; console.log(`  \x1b[31m✗\x1b[0m ${name}: ${e.message}`); } }

console.log('\x1b[1mSlice 337 — Abstract Syntax Tree + AST Visitor\x1b[0m\n');
console.log('\x1b[36m  Part 1: Abstract Syntax Tree\x1b[0m');
test('abstract-syntax-tree.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/abstract-syntax-tree.mjs')));
const { createAST } = await import('../../tools/ogu/commands/lib/abstract-syntax-tree.mjs');
test('create node', () => { const node = createAST('Program'); assert.equal(node.getType(), 'Program'); });
test('add children', () => { const root = createAST('Program'); root.addChild(createAST('Statement', 'x = 1')); assert.equal(root.getChildren().length, 1); });
test('depth calculation', () => { const r = createAST('Root'); const c = r.addChild(createAST('Child')); c.addChild(createAST('Leaf')); assert.equal(r.depth(), 2); });
test('toJSON', () => { const n = createAST('Expr', '42'); const j = n.toJSON(); assert.equal(j.type, 'Expr'); assert.equal(j.value, '42'); });
test('metadata', () => { const n = createAST('X'); n.setMeta('line', 5); assert.equal(n.getMeta('line'), 5); });

console.log('\n\x1b[36m  Part 2: AST Visitor\x1b[0m');
test('ast-visitor.mjs exists', () => assert.ok(existsSync('tools/ogu/commands/lib/ast-visitor.mjs')));
const { createASTVisitor } = await import('../../tools/ogu/commands/lib/ast-visitor.mjs');
test('visit nodes', () => { const v = createASTVisitor(); const visited = []; v.on('Expr', n => visited.push(n.getValue())); const root = createAST('Program'); root.addChild(createAST('Expr', 'a')); root.addChild(createAST('Expr', 'b')); v.visit(root); assert.deepEqual(visited, ['a', 'b']); });
test('visit with result', () => { const v = createASTVisitor(); v.on('Num', (n, acc) => acc + Number(n.getValue())); const root = createAST('Sum'); root.addChild(createAST('Num', '3')); root.addChild(createAST('Num', '4')); assert.equal(v.visitWithResult(root, 0), 7); });
test('list handlers', () => { const v = createASTVisitor(); v.on('A', () => {}); v.on('B', () => {}); assert.deepEqual(v.listHandlers(), ['A', 'B']); });

console.log(`\n\x1b[1m  Results: ${passed} passed, ${failed} failed\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
