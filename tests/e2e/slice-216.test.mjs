/**
 * Slice 216 — Red-Black Tree + AVL Tree
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 216 — Red-Black Tree + AVL Tree\x1b[0m\n");

console.log("\x1b[36m  Part 1: Red-Black Tree\x1b[0m");
const rbLib = join(process.cwd(), "tools/ogu/commands/lib/red-black-tree.mjs");
assert("red-black-tree.mjs exists", () => { if (!existsSync(rbLib)) throw new Error("missing"); });
const rbMod = await import(rbLib);
assert("insert and search", () => {
  const rbt = rbMod.createRedBlackTree();
  rbt.insert(10); rbt.insert(5); rbt.insert(15);
  if (!rbt.search(10)) throw new Error("should find 10");
  if (rbt.search(7)) throw new Error("should not find 7");
});
assert("inOrder returns sorted", () => {
  const rbt = rbMod.createRedBlackTree();
  rbt.insert(30); rbt.insert(10); rbt.insert(20);
  const arr = rbt.inOrder();
  if (arr[0] !== 10 || arr[1] !== 20 || arr[2] !== 30) throw new Error("wrong order");
});
assert("handles many inserts", () => {
  const rbt = rbMod.createRedBlackTree();
  for (let i = 0; i < 50; i++) rbt.insert(i);
  const arr = rbt.inOrder();
  if (arr.length !== 50) throw new Error(`expected 50, got ${arr.length}`);
});

console.log("\n\x1b[36m  Part 2: AVL Tree\x1b[0m");
const avlLib = join(process.cwd(), "tools/ogu/commands/lib/avl-tree.mjs");
assert("avl-tree.mjs exists", () => { if (!existsSync(avlLib)) throw new Error("missing"); });
const avlMod = await import(avlLib);
assert("insert and search", () => {
  const avl = avlMod.createAVLTree();
  avl.insert(10); avl.insert(5); avl.insert(15);
  if (!avl.search(10)) throw new Error("should find 10");
  if (avl.search(7)) throw new Error("should not find 7");
});
assert("inOrder returns sorted", () => {
  const avl = avlMod.createAVLTree();
  avl.insert(30); avl.insert(10); avl.insert(20);
  const arr = avl.inOrder();
  if (arr[0] !== 10 || arr[1] !== 20 || arr[2] !== 30) throw new Error("wrong order");
});
assert("maintains balance after many inserts", () => {
  const avl = avlMod.createAVLTree();
  for (let i = 0; i < 50; i++) avl.insert(i);
  const h = avl.height();
  if (h > 10) throw new Error(`height ${h} too large for 50 nodes`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
