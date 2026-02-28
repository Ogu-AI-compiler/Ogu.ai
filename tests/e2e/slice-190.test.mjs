/**
 * Slice 190 — Debouncer + Throttler
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 190 — Debouncer + Throttler\x1b[0m\n");

console.log("\x1b[36m  Part 1: Debouncer\x1b[0m");
const dLib = join(process.cwd(), "tools/ogu/commands/lib/debouncer.mjs");
assert("debouncer.mjs exists", () => { if (!existsSync(dLib)) throw new Error("missing"); });
const dMod = await import(dLib);
assert("createDebouncer returns debouncer", () => {
  const d = dMod.createDebouncer({ delayMs: 100 });
  if (typeof d.call !== "function") throw new Error("missing call");
  if (typeof d.flush !== "function") throw new Error("missing flush");
  if (typeof d.cancel !== "function") throw new Error("missing cancel");
});
assert("flush executes pending", () => {
  const results = [];
  const d = dMod.createDebouncer({ delayMs: 99999 });
  d.call(() => results.push("a"));
  d.flush();
  if (results.length !== 1) throw new Error(`expected 1, got ${results.length}`);
});
assert("cancel prevents execution", () => {
  const results = [];
  const d = dMod.createDebouncer({ delayMs: 99999 });
  d.call(() => results.push("a"));
  d.cancel();
  d.flush();
  if (results.length !== 0) throw new Error("should not execute");
});

console.log("\n\x1b[36m  Part 2: Throttler\x1b[0m");
const tLib = join(process.cwd(), "tools/ogu/commands/lib/throttler.mjs");
assert("throttler.mjs exists", () => { if (!existsSync(tLib)) throw new Error("missing"); });
const tMod = await import(tLib);
assert("createThrottler returns throttler", () => {
  const t = tMod.createThrottler({ intervalMs: 100 });
  if (typeof t.tryCall !== "function") throw new Error("missing tryCall");
});
assert("tryCall allows first call", () => {
  const t = tMod.createThrottler({ intervalMs: 100 });
  const results = [];
  if (!t.tryCall(() => results.push("a"))) throw new Error("first should succeed");
  if (results.length !== 1) throw new Error("should execute");
});
assert("tryCall blocks rapid calls", () => {
  const t = tMod.createThrottler({ intervalMs: 999999 });
  t.tryCall(() => {});
  if (t.tryCall(() => {})) throw new Error("should block");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
