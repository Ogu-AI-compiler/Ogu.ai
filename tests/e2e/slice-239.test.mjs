/**
 * Slice 239 — Linked List + Doubly Linked List
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 239 — Linked List + Doubly Linked List\x1b[0m\n");
console.log("\x1b[36m  Part 1: Linked List\x1b[0m");
const llLib = join(process.cwd(), "tools/ogu/commands/lib/linked-list.mjs");
assert("linked-list.mjs exists", () => { if (!existsSync(llLib)) throw new Error("missing"); });
const llMod = await import(llLib);
assert("append and toArray", () => {
  const ll = llMod.createLinkedList();
  ll.append(1); ll.append(2); ll.append(3);
  const arr = ll.toArray();
  if (arr[0]!==1||arr[2]!==3) throw new Error("wrong");
});
assert("prepend adds to front", () => {
  const ll = llMod.createLinkedList();
  ll.append(2); ll.prepend(1);
  if (ll.toArray()[0]!==1) throw new Error("should be 1");
});
assert("size tracks count", () => {
  const ll = llMod.createLinkedList();
  ll.append(1); ll.append(2);
  if (ll.size()!==2) throw new Error("expected 2");
});
console.log("\n\x1b[36m  Part 2: Doubly Linked List\x1b[0m");
const dllLib = join(process.cwd(), "tools/ogu/commands/lib/doubly-linked-list.mjs");
assert("doubly-linked-list.mjs exists", () => { if (!existsSync(dllLib)) throw new Error("missing"); });
const dllMod = await import(dllLib);
assert("append and toArray", () => {
  const dl = dllMod.createDoublyLinkedList();
  dl.append(1); dl.append(2); dl.append(3);
  if (dl.toArray()[2]!==3) throw new Error("wrong");
});
assert("reverse traversal", () => {
  const dl = dllMod.createDoublyLinkedList();
  dl.append(1); dl.append(2); dl.append(3);
  const rev = dl.toArrayReverse();
  if (rev[0]!==3||rev[2]!==1) throw new Error("wrong reverse");
});
assert("remove works", () => {
  const dl = dllMod.createDoublyLinkedList();
  dl.append(1); dl.append(2); dl.append(3);
  dl.remove(2);
  if (dl.size()!==2) throw new Error("expected 2");
});
console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
