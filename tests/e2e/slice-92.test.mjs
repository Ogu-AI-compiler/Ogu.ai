/**
 * Slice 92 — Content Hasher + Integrity Checker
 *
 * Content hasher: hash files/strings with multiple algorithms.
 * Integrity checker: verify file integrity against known hashes.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice92-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 92 — Content Hasher + Integrity Checker\x1b[0m\n");

// ── Part 1: Content Hasher ──────────────────────────────

console.log("\x1b[36m  Part 1: Content Hasher\x1b[0m");

const chLib = join(process.cwd(), "tools/ogu/commands/lib/content-hasher.mjs");
assert("content-hasher.mjs exists", () => {
  if (!existsSync(chLib)) throw new Error("file missing");
});

const chMod = await import(chLib);

assert("hashString returns consistent hash", () => {
  if (typeof chMod.hashString !== "function") throw new Error("missing");
  const h1 = chMod.hashString("hello world");
  const h2 = chMod.hashString("hello world");
  if (h1 !== h2) throw new Error("should be deterministic");
  if (typeof h1 !== "string" || h1.length === 0) throw new Error("should return non-empty string");
});

assert("hashString different inputs produce different hashes", () => {
  const h1 = chMod.hashString("foo");
  const h2 = chMod.hashString("bar");
  if (h1 === h2) throw new Error("different inputs should differ");
});

assert("hashFile hashes file contents", () => {
  if (typeof chMod.hashFile !== "function") throw new Error("missing");
  writeFileSync(join(tmp, "test.txt"), "test content");
  const hash = chMod.hashFile(join(tmp, "test.txt"));
  if (typeof hash !== "string" || hash.length === 0) throw new Error("should return hash");
});

assert("hashString supports algorithm option", () => {
  const md5 = chMod.hashString("test", { algorithm: "md5" });
  const sha256 = chMod.hashString("test", { algorithm: "sha256" });
  if (md5 === sha256) throw new Error("different algorithms should produce different hashes");
});

// ── Part 2: Integrity Checker ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Integrity Checker\x1b[0m");

const icLib = join(process.cwd(), "tools/ogu/commands/lib/integrity-checker.mjs");
assert("integrity-checker.mjs exists", () => {
  if (!existsSync(icLib)) throw new Error("file missing");
});

const icMod = await import(icLib);

assert("createIntegrityChecker returns checker", () => {
  if (typeof icMod.createIntegrityChecker !== "function") throw new Error("missing");
  const ic = icMod.createIntegrityChecker();
  if (typeof ic.register !== "function") throw new Error("missing register");
  if (typeof ic.verify !== "function") throw new Error("missing verify");
});

assert("register stores file hash", () => {
  const ic = icMod.createIntegrityChecker();
  writeFileSync(join(tmp, "a.txt"), "content-a");
  ic.register(join(tmp, "a.txt"));
  const manifest = ic.getManifest();
  if (Object.keys(manifest).length !== 1) throw new Error("should have 1 entry");
});

assert("verify passes for unchanged file", () => {
  const ic = icMod.createIntegrityChecker();
  const f = join(tmp, "unchanged.txt");
  writeFileSync(f, "original");
  ic.register(f);
  const result = ic.verify(f);
  if (!result.valid) throw new Error("unchanged file should pass");
});

assert("verify fails for modified file", () => {
  const ic = icMod.createIntegrityChecker();
  const f = join(tmp, "changed.txt");
  writeFileSync(f, "original");
  ic.register(f);
  writeFileSync(f, "modified");
  const result = ic.verify(f);
  if (result.valid) throw new Error("modified file should fail");
});

assert("verifyAll checks all registered files", () => {
  const ic = icMod.createIntegrityChecker();
  const f1 = join(tmp, "v1.txt");
  const f2 = join(tmp, "v2.txt");
  writeFileSync(f1, "a");
  writeFileSync(f2, "b");
  ic.register(f1);
  ic.register(f2);
  const results = ic.verifyAll();
  if (results.total !== 2) throw new Error(`expected 2 total, got ${results.total}`);
  if (results.passed !== 2) throw new Error(`expected 2 passed, got ${results.passed}`);
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
