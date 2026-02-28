/**
 * Slice 209 — Content Negotiator + Media Type Parser
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 209 — Content Negotiator + Media Type Parser\x1b[0m\n");

console.log("\x1b[36m  Part 1: Content Negotiator\x1b[0m");
const cnLib = join(process.cwd(), "tools/ogu/commands/lib/content-negotiator.mjs");
assert("content-negotiator.mjs exists", () => { if (!existsSync(cnLib)) throw new Error("missing"); });
const cnMod = await import(cnLib);
assert("negotiate selects best match", () => {
  const cn = cnMod.createContentNegotiator();
  cn.addFormat("application/json");
  cn.addFormat("text/html");
  const result = cn.negotiate("application/json, text/html;q=0.9");
  if (result !== "application/json") throw new Error(`expected application/json, got ${result}`);
});
assert("respects quality values", () => {
  const cn = cnMod.createContentNegotiator();
  cn.addFormat("text/plain");
  cn.addFormat("text/html");
  const result = cn.negotiate("text/plain;q=0.5, text/html;q=0.9");
  if (result !== "text/html") throw new Error(`expected text/html, got ${result}`);
});
assert("returns null when no match", () => {
  const cn = cnMod.createContentNegotiator();
  cn.addFormat("application/json");
  if (cn.negotiate("text/xml") !== null) throw new Error("should be null");
});

console.log("\n\x1b[36m  Part 2: Media Type Parser\x1b[0m");
const mtLib = join(process.cwd(), "tools/ogu/commands/lib/media-type-parser.mjs");
assert("media-type-parser.mjs exists", () => { if (!existsSync(mtLib)) throw new Error("missing"); });
const mtMod = await import(mtLib);
assert("parse basic media type", () => {
  const parsed = mtMod.parse("application/json");
  if (parsed.type !== "application" || parsed.subtype !== "json") throw new Error("wrong");
});
assert("parse with parameters", () => {
  const parsed = mtMod.parse("text/html; charset=utf-8");
  if (parsed.type !== "text" || parsed.subtype !== "html") throw new Error("wrong type");
  if (parsed.params.charset !== "utf-8") throw new Error("wrong charset");
});
assert("format reconstructs media type", () => {
  const result = mtMod.format({ type: "application", subtype: "json", params: {} });
  if (result !== "application/json") throw new Error(`expected application/json, got ${result}`);
});
assert("isMatch compares types", () => {
  if (!mtMod.isMatch("application/json", "application/json")) throw new Error("should match");
  if (mtMod.isMatch("application/json", "text/html")) throw new Error("should not match");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
