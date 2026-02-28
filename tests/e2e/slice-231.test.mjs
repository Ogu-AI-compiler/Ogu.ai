/**
 * Slice 231 — Fractal Generator + Turtle Graphics
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 231 — Fractal Generator + Turtle Graphics\x1b[0m\n");

console.log("\x1b[36m  Part 1: Fractal Generator\x1b[0m");
const fgLib = join(process.cwd(), "tools/ogu/commands/lib/fractal-generator.mjs");
assert("fractal-generator.mjs exists", () => { if (!existsSync(fgLib)) throw new Error("missing"); });
const fgMod = await import(fgLib);
assert("sierpinski generates points", () => {
  const points = fgMod.sierpinski(3);
  if (!Array.isArray(points) || points.length === 0) throw new Error("should return points");
});
assert("mandelbrot computes iterations", () => {
  const iter = fgMod.mandelbrot(0, 0, 100);
  if (iter !== 100) throw new Error(`origin should reach max iter, got ${iter}`);
});
assert("mandelbrot diverges for outside points", () => {
  const iter = fgMod.mandelbrot(2, 2, 100);
  if (iter >= 100) throw new Error("should diverge quickly");
});

console.log("\n\x1b[36m  Part 2: Turtle Graphics\x1b[0m");
const tgLib = join(process.cwd(), "tools/ogu/commands/lib/turtle-graphics.mjs");
assert("turtle-graphics.mjs exists", () => { if (!existsSync(tgLib)) throw new Error("missing"); });
const tgMod = await import(tgLib);
assert("forward moves turtle", () => {
  const t = tgMod.createTurtle();
  t.forward(10);
  const pos = t.getPosition();
  if (Math.abs(pos.x - 10) > 0.01) throw new Error(`expected x=10, got ${pos.x}`);
});
assert("turn changes direction", () => {
  const t = tgMod.createTurtle();
  t.right(90); t.forward(10);
  const pos = t.getPosition();
  if (Math.abs(pos.y - (-10)) > 0.01) throw new Error(`expected y=-10, got ${pos.y}`);
});
assert("getPath returns trail", () => {
  const t = tgMod.createTurtle();
  t.forward(5); t.right(90); t.forward(5);
  const path = t.getPath();
  if (path.length !== 3) throw new Error(`expected 3 points, got ${path.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
