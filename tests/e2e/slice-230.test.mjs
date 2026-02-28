/**
 * Slice 230 — Morton Code + Hilbert Curve
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 230 — Morton Code + Hilbert Curve\x1b[0m\n");

console.log("\x1b[36m  Part 1: Morton Code\x1b[0m");
const mcLib = join(process.cwd(), "tools/ogu/commands/lib/morton-code.mjs");
assert("morton-code.mjs exists", () => { if (!existsSync(mcLib)) throw new Error("missing"); });
const mcMod = await import(mcLib);
assert("encode and decode roundtrip", () => {
  const code = mcMod.encode(5, 10);
  const [x, y] = mcMod.decode(code);
  if (x !== 5 || y !== 10) throw new Error(`expected (5,10), got (${x},${y})`);
});
assert("different coords give different codes", () => {
  const a = mcMod.encode(0, 0);
  const b = mcMod.encode(1, 1);
  if (a === b) throw new Error("should differ");
});

console.log("\n\x1b[36m  Part 2: Hilbert Curve\x1b[0m");
const hcLib = join(process.cwd(), "tools/ogu/commands/lib/hilbert-curve.mjs");
assert("hilbert-curve.mjs exists", () => { if (!existsSync(hcLib)) throw new Error("missing"); });
const hcMod = await import(hcLib);
assert("xy2d and d2xy roundtrip", () => {
  const d = hcMod.xy2d(4, 2, 3);
  const [x, y] = hcMod.d2xy(4, d);
  if (x !== 2 || y !== 3) throw new Error(`expected (2,3), got (${x},${y})`);
});
assert("all points in NxN are unique", () => {
  const n = 4;
  const seen = new Set();
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const d = hcMod.xy2d(n, x, y);
      if (seen.has(d)) throw new Error(`duplicate d=${d}`);
      seen.add(d);
    }
  }
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
