/**
 * Slice 187 — Priority Queue + Min Heap
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}
console.log("\n\x1b[1mSlice 187 — Priority Queue + Min Heap\x1b[0m\n");

console.log("\x1b[36m  Part 1: Priority Queue\x1b[0m");
const pqLib = join(process.cwd(), "tools/ogu/commands/lib/priority-queue.mjs");
assert("priority-queue.mjs exists", () => { if (!existsSync(pqLib)) throw new Error("missing"); });
const pqMod = await import(pqLib);
assert("createPriorityQueue works", () => {
  const pq = pqMod.createPriorityQueue();
  pq.enqueue("low", 1); pq.enqueue("high", 10); pq.enqueue("mid", 5);
  if (pq.dequeue() !== "high") throw new Error("should get highest first");
  if (pq.dequeue() !== "mid") throw new Error("should get mid second");
});
assert("peek returns top without removing", () => {
  const pq = pqMod.createPriorityQueue();
  pq.enqueue("a", 5);
  if (pq.peek() !== "a") throw new Error("should peek a");
  if (pq.size() !== 1) throw new Error("peek should not remove");
});
assert("dequeue from empty returns null", () => {
  const pq = pqMod.createPriorityQueue();
  if (pq.dequeue() !== null) throw new Error("should return null");
});

console.log("\n\x1b[36m  Part 2: Min Heap\x1b[0m");
const mhLib = join(process.cwd(), "tools/ogu/commands/lib/min-heap.mjs");
assert("min-heap.mjs exists", () => { if (!existsSync(mhLib)) throw new Error("missing"); });
const mhMod = await import(mhLib);
assert("createMinHeap works", () => {
  const h = mhMod.createMinHeap();
  h.push(5); h.push(2); h.push(8); h.push(1);
  if (h.pop() !== 1) throw new Error("min should be 1");
  if (h.pop() !== 2) throw new Error("next should be 2");
});
assert("peek returns min", () => {
  const h = mhMod.createMinHeap();
  h.push(10); h.push(3);
  if (h.peek() !== 3) throw new Error("min should be 3");
  if (h.size() !== 2) throw new Error("peek should not remove");
});
assert("empty heap pop returns null", () => {
  const h = mhMod.createMinHeap();
  if (h.pop() !== null) throw new Error("should return null");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
