/**
 * Slice 220 — Deque Buffer + Double-Ended Queue
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 220 — Deque Buffer + Double-Ended Queue\x1b[0m\n");

console.log("\x1b[36m  Part 1: Deque Buffer\x1b[0m");
const dbLib = join(process.cwd(), "tools/ogu/commands/lib/deque-buffer.mjs");
assert("deque-buffer.mjs exists", () => { if (!existsSync(dbLib)) throw new Error("missing"); });
const dbMod = await import(dbLib);
assert("pushFront and pushBack", () => {
  const d = dbMod.createDequeBuffer();
  d.pushBack(1); d.pushBack(2); d.pushFront(0);
  if (d.peekFront() !== 0) throw new Error("front should be 0");
  if (d.peekBack() !== 2) throw new Error("back should be 2");
});
assert("popFront and popBack", () => {
  const d = dbMod.createDequeBuffer();
  d.pushBack(1); d.pushBack(2); d.pushBack(3);
  if (d.popFront() !== 1) throw new Error("should pop 1");
  if (d.popBack() !== 3) throw new Error("should pop 3");
});
assert("size tracks count", () => {
  const d = dbMod.createDequeBuffer();
  d.pushBack(1); d.pushBack(2);
  if (d.size() !== 2) throw new Error("expected 2");
  d.popFront();
  if (d.size() !== 1) throw new Error("expected 1");
});

console.log("\n\x1b[36m  Part 2: Double-Ended Queue\x1b[0m");
const deqLib = join(process.cwd(), "tools/ogu/commands/lib/double-ended-queue.mjs");
assert("double-ended-queue.mjs exists", () => { if (!existsSync(deqLib)) throw new Error("missing"); });
const deqMod = await import(deqLib);
assert("addFirst and addLast", () => {
  const q = deqMod.createDoubleEndedQueue();
  q.addFirst("a"); q.addLast("b"); q.addFirst("z");
  if (q.peekFirst() !== "z") throw new Error("first should be z");
  if (q.peekLast() !== "b") throw new Error("last should be b");
});
assert("removeFirst and removeLast", () => {
  const q = deqMod.createDoubleEndedQueue();
  q.addLast(1); q.addLast(2); q.addLast(3);
  if (q.removeFirst() !== 1) throw new Error("should be 1");
  if (q.removeLast() !== 3) throw new Error("should be 3");
});
assert("toArray returns correct order", () => {
  const q = deqMod.createDoubleEndedQueue();
  q.addLast(1); q.addLast(2); q.addLast(3);
  const arr = q.toArray();
  if (arr[0] !== 1 || arr[2] !== 3) throw new Error("wrong order");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
