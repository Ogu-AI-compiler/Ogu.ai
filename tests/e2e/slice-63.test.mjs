/**
 * Slice 63 — Diff Engine + Patch Applier
 *
 * Diff engine: compute structured diffs between JSON configs/code.
 * Patch applier: apply JSON patches to config files.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice63-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 63 — Diff Engine + Patch Applier\x1b[0m\n");

// ── Part 1: Diff Engine ──────────────────────────────

console.log("\x1b[36m  Part 1: Diff Engine\x1b[0m");

const diffLib = join(process.cwd(), "tools/ogu/commands/lib/diff-engine.mjs");
assert("diff-engine.mjs exists", () => {
  if (!existsSync(diffLib)) throw new Error("file missing");
});

const diffMod = await import(diffLib);

assert("diffJson computes additions", () => {
  if (typeof diffMod.diffJson !== "function") throw new Error("missing");
  const diff = diffMod.diffJson({ a: 1 }, { a: 1, b: 2 });
  if (!Array.isArray(diff)) throw new Error("should return array");
  const added = diff.filter(d => d.type === "added");
  if (added.length < 1) throw new Error("should detect addition");
});

assert("diffJson computes removals", () => {
  const diff = diffMod.diffJson({ a: 1, b: 2 }, { a: 1 });
  const removed = diff.filter(d => d.type === "removed");
  if (removed.length < 1) throw new Error("should detect removal");
});

assert("diffJson computes changes", () => {
  const diff = diffMod.diffJson({ a: 1, b: "old" }, { a: 1, b: "new" });
  const changed = diff.filter(d => d.type === "changed");
  if (changed.length < 1) throw new Error("should detect change");
  if (changed[0].path !== "b") throw new Error("should identify path");
});

assert("diffJson returns empty for identical objects", () => {
  const diff = diffMod.diffJson({ x: 1 }, { x: 1 });
  if (diff.length !== 0) throw new Error("should be empty for identical");
});

assert("diffLines computes line diffs", () => {
  if (typeof diffMod.diffLines !== "function") throw new Error("missing");
  const diff = diffMod.diffLines("line1\nline2\nline3", "line1\nmodified\nline3");
  if (!Array.isArray(diff)) throw new Error("should return array");
  if (diff.length < 1) throw new Error("should detect differences");
});

// ── Part 2: Patch Applier ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Patch Applier\x1b[0m");

const patchLib = join(process.cwd(), "tools/ogu/commands/lib/patch-applier.mjs");
assert("patch-applier.mjs exists", () => {
  if (!existsSync(patchLib)) throw new Error("file missing");
});

const patchMod = await import(patchLib);

assert("applyPatch adds new fields", () => {
  if (typeof patchMod.applyPatch !== "function") throw new Error("missing");
  const result = patchMod.applyPatch({ a: 1 }, [{ op: "add", path: "b", value: 2 }]);
  if (result.b !== 2) throw new Error("should add b");
  if (result.a !== 1) throw new Error("should keep a");
});

assert("applyPatch removes fields", () => {
  const result = patchMod.applyPatch({ a: 1, b: 2 }, [{ op: "remove", path: "b" }]);
  if (result.b !== undefined) throw new Error("should remove b");
  if (result.a !== 1) throw new Error("should keep a");
});

assert("applyPatch replaces values", () => {
  const result = patchMod.applyPatch({ a: 1 }, [{ op: "replace", path: "a", value: 99 }]);
  if (result.a !== 99) throw new Error("should replace a");
});

assert("applyPatch applies multiple operations", () => {
  const result = patchMod.applyPatch({ a: 1 }, [
    { op: "add", path: "b", value: 2 },
    { op: "replace", path: "a", value: 10 },
    { op: "add", path: "c", value: 3 },
  ]);
  if (result.a !== 10) throw new Error("a should be 10");
  if (result.b !== 2) throw new Error("b should be 2");
  if (result.c !== 3) throw new Error("c should be 3");
});

assert("createPatch generates operations from diff", () => {
  if (typeof patchMod.createPatch !== "function") throw new Error("missing");
  const ops = patchMod.createPatch({ a: 1 }, { a: 2, b: 3 });
  if (!Array.isArray(ops)) throw new Error("should return array");
  if (ops.length < 2) throw new Error("should have at least 2 ops");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
