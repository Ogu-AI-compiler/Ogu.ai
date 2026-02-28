/**
 * Slice 203 — Color Space Converter + Color Palette Generator
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 203 — Color Space Converter + Color Palette Generator\x1b[0m\n");

console.log("\x1b[36m  Part 1: Color Space Converter\x1b[0m");
const csLib = join(process.cwd(), "tools/ogu/commands/lib/color-space-converter.mjs");
assert("color-space-converter.mjs exists", () => { if (!existsSync(csLib)) throw new Error("missing"); });
const csMod = await import(csLib);
assert("hexToRgb converts correctly", () => {
  const rgb = csMod.hexToRgb("#FF0000");
  if (rgb.r !== 255 || rgb.g !== 0 || rgb.b !== 0) throw new Error(`wrong: ${JSON.stringify(rgb)}`);
});
assert("rgbToHex converts correctly", () => {
  const hex = csMod.rgbToHex(255, 0, 0);
  if (hex !== "#FF0000") throw new Error(`expected #FF0000, got ${hex}`);
});
assert("rgbToHsl converts correctly", () => {
  const hsl = csMod.rgbToHsl(255, 0, 0);
  if (hsl.h !== 0 || hsl.s !== 100 || hsl.l !== 50) throw new Error(`wrong: ${JSON.stringify(hsl)}`);
});
assert("hslToRgb converts correctly", () => {
  const rgb = csMod.hslToRgb(0, 100, 50);
  if (rgb.r !== 255 || rgb.g !== 0 || rgb.b !== 0) throw new Error(`wrong: ${JSON.stringify(rgb)}`);
});

console.log("\n\x1b[36m  Part 2: Color Palette Generator\x1b[0m");
const cpLib = join(process.cwd(), "tools/ogu/commands/lib/color-palette-generator.mjs");
assert("color-palette-generator.mjs exists", () => { if (!existsSync(cpLib)) throw new Error("missing"); });
const cpMod = await import(cpLib);
assert("complementary returns 2 colors", () => {
  const palette = cpMod.complementary("#FF0000");
  if (palette.length !== 2) throw new Error(`expected 2, got ${palette.length}`);
});
assert("analogous returns 3 colors", () => {
  const palette = cpMod.analogous("#FF0000");
  if (palette.length !== 3) throw new Error(`expected 3, got ${palette.length}`);
});
assert("triadic returns 3 colors", () => {
  const palette = cpMod.triadic("#FF0000");
  if (palette.length !== 3) throw new Error(`expected 3, got ${palette.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
