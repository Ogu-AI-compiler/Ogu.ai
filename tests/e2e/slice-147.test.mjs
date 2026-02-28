/**
 * Slice 147 — Commit Message Generator + Changelog Builder
 *
 * Commit Message Generator: generate conventional commit messages.
 * Changelog Builder: build changelogs from commit history.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 147 — Commit Message Generator + Changelog Builder\x1b[0m\n");

// ── Part 1: Commit Message Generator ──────────────────────────────

console.log("\x1b[36m  Part 1: Commit Message Generator\x1b[0m");

const cmgLib = join(process.cwd(), "tools/ogu/commands/lib/commit-message-generator.mjs");
assert("commit-message-generator.mjs exists", () => {
  if (!existsSync(cmgLib)) throw new Error("file missing");
});

const cmgMod = await import(cmgLib);

assert("generateCommitMessage returns message", () => {
  if (typeof cmgMod.generateCommitMessage !== "function") throw new Error("missing");
  const msg = cmgMod.generateCommitMessage({
    type: "feat",
    scope: "auth",
    description: "add login flow",
  });
  if (!msg.includes("feat")) throw new Error("should include type");
  if (!msg.includes("auth")) throw new Error("should include scope");
});

assert("supports conventional commit types", () => {
  const types = ["feat", "fix", "refactor", "docs", "test", "chore"];
  for (const type of types) {
    const msg = cmgMod.generateCommitMessage({ type, description: "something" });
    if (!msg.startsWith(type)) throw new Error(`should start with ${type}`);
  }
});

assert("includes breaking change marker", () => {
  const msg = cmgMod.generateCommitMessage({
    type: "feat",
    description: "new API",
    breaking: true,
  });
  if (!msg.includes("!")) throw new Error("should have breaking marker");
});

assert("formatCommitBody adds details", () => {
  if (typeof cmgMod.formatCommitBody !== "function") throw new Error("missing");
  const body = cmgMod.formatCommitBody({
    description: "Changed the auth flow",
    filesChanged: ["src/auth.ts", "src/api.ts"],
    agent: "backend-dev",
  });
  if (!body.includes("auth.ts")) throw new Error("should list files");
});

// ── Part 2: Changelog Builder ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Changelog Builder\x1b[0m");

const clbLib = join(process.cwd(), "tools/ogu/commands/lib/changelog-builder.mjs");
assert("changelog-builder.mjs exists", () => {
  if (!existsSync(clbLib)) throw new Error("file missing");
});

const clbMod = await import(clbLib);

assert("createChangelogBuilder returns builder", () => {
  if (typeof clbMod.createChangelogBuilder !== "function") throw new Error("missing");
  const builder = clbMod.createChangelogBuilder();
  if (typeof builder.addEntry !== "function") throw new Error("missing addEntry");
  if (typeof builder.build !== "function") throw new Error("missing build");
});

assert("addEntry and build creates changelog", () => {
  const builder = clbMod.createChangelogBuilder();
  builder.addEntry({ type: "feat", description: "add login", version: "1.0.0" });
  builder.addEntry({ type: "fix", description: "fix crash", version: "1.0.0" });
  const md = builder.build();
  if (!md.includes("add login")) throw new Error("should include feat");
  if (!md.includes("fix crash")) throw new Error("should include fix");
});

assert("groups by version", () => {
  const builder = clbMod.createChangelogBuilder();
  builder.addEntry({ type: "feat", description: "a", version: "2.0.0" });
  builder.addEntry({ type: "feat", description: "b", version: "1.0.0" });
  const md = builder.build();
  const idx2 = md.indexOf("2.0.0");
  const idx1 = md.indexOf("1.0.0");
  if (idx2 > idx1) throw new Error("newer version should come first");
});

assert("groups by type within version", () => {
  const builder = clbMod.createChangelogBuilder();
  builder.addEntry({ type: "feat", description: "new feature", version: "1.0.0" });
  builder.addEntry({ type: "fix", description: "bug fix", version: "1.0.0" });
  const md = builder.build();
  if (!md.includes("feat") || !md.includes("fix")) throw new Error("should group by type");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
