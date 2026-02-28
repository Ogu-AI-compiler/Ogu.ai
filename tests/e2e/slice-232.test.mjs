/**
 * Slice 232 — L-System + Lindenmayer Engine
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 232 — L-System + Lindenmayer Engine\x1b[0m\n");

console.log("\x1b[36m  Part 1: L-System\x1b[0m");
const lsLib = join(process.cwd(), "tools/ogu/commands/lib/l-system.mjs");
assert("l-system.mjs exists", () => { if (!existsSync(lsLib)) throw new Error("missing"); });
const lsMod = await import(lsLib);
assert("generate applies rules", () => {
  const result = lsMod.generate("A", { A: "AB", B: "A" }, 2);
  if (result !== "ABA") throw new Error(`expected ABA, got ${result}`);
});
assert("0 iterations returns axiom", () => {
  const result = lsMod.generate("X", { X: "YZ" }, 0);
  if (result !== "X") throw new Error(`expected X, got ${result}`);
});
assert("handles missing rules (identity)", () => {
  const result = lsMod.generate("AB", { A: "AA" }, 1);
  if (result !== "AAB") throw new Error(`expected AAB, got ${result}`);
});

console.log("\n\x1b[36m  Part 2: Lindenmayer Engine\x1b[0m");
const leLib = join(process.cwd(), "tools/ogu/commands/lib/lindenmayer-engine.mjs");
assert("lindenmayer-engine.mjs exists", () => { if (!existsSync(leLib)) throw new Error("missing"); });
const leMod = await import(leLib);
assert("createLSystem with rules and iterate", () => {
  const ls = leMod.createLSystem({ axiom: "A", rules: { A: "AB", B: "A" } });
  ls.iterate(3);
  const str = ls.getString();
  if (str !== "ABAAB") throw new Error(`expected ABAAB, got ${str}`);
});
assert("getGeneration tracks iterations", () => {
  const ls = leMod.createLSystem({ axiom: "X", rules: { X: "XY" } });
  ls.iterate(2);
  if (ls.getGeneration() !== 2) throw new Error("expected generation 2");
});
assert("reset returns to axiom", () => {
  const ls = leMod.createLSystem({ axiom: "A", rules: { A: "AB" } });
  ls.iterate(5);
  ls.reset();
  if (ls.getString() !== "A") throw new Error("should reset to A");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
