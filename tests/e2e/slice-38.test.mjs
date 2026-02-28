/**
 * Slice 38 — Semantic Mutex + Worktree Manager (P35 partial + Kadima ext)
 *
 * Semantic Mutex: AST-aware file locking (function/class level).
 * Worktree Manager: git worktree lifecycle per agent.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice38-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/locks"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

// Create a source file for semantic locking
mkdirSync(join(tmp, "src"), { recursive: true });
writeFileSync(join(tmp, "src/utils.ts"), `
export function calculate(a: number, b: number): number {
  return a + b;
}

export function format(value: string): string {
  return value.trim();
}

export class DataStore {
  private items: any[] = [];

  add(item: any) {
    this.items.push(item);
  }

  get(index: number) {
    return this.items[index];
  }
}
`);

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 38 — Semantic Mutex + Worktree Manager\x1b[0m\n");
console.log("  AST-aware locking, git worktree lifecycle\n");

// ── Part 1: Semantic Mutex ──────────────────────────────

console.log("\x1b[36m  Part 1: Semantic Mutex\x1b[0m");

const smLib = join(process.cwd(), "tools/ogu/commands/lib/semantic-mutex.mjs");
assert("semantic-mutex.mjs exists", () => {
  if (!existsSync(smLib)) throw new Error("file missing");
});

const smMod = await import(smLib);

assert("extractSymbols finds functions and classes", () => {
  if (typeof smMod.extractSymbols !== "function") throw new Error("missing");
  const symbols = smMod.extractSymbols({ filePath: join(tmp, "src/utils.ts") });
  if (!Array.isArray(symbols)) throw new Error("not array");
  if (symbols.length < 3) throw new Error(`expected at least 3 symbols, got ${symbols.length}`);
  const names = symbols.map(s => s.name);
  if (!names.includes("calculate")) throw new Error("missing calculate");
  if (!names.includes("format")) throw new Error("missing format");
  if (!names.includes("DataStore")) throw new Error("missing DataStore");
});

assert("acquireSymbolLock locks a specific symbol", () => {
  if (typeof smMod.acquireSymbolLock !== "function") throw new Error("missing");
  const lock = smMod.acquireSymbolLock({
    root: tmp,
    filePath: "src/utils.ts",
    symbol: "calculate",
    roleId: "developer",
    taskId: "t1",
  });
  if (!lock.id) throw new Error("no lock id");
  if (lock.symbol !== "calculate") throw new Error("wrong symbol");
});

assert("acquireSymbolLock rejects conflict on same symbol", () => {
  let threw = false;
  try {
    smMod.acquireSymbolLock({
      root: tmp,
      filePath: "src/utils.ts",
      symbol: "calculate",
      roleId: "architect",
      taskId: "t2",
    });
  } catch (e) {
    threw = true;
    if (!e.message.includes("locked") && !e.message.includes("conflict")) {
      throw new Error(`wrong error: ${e.message}`);
    }
  }
  if (!threw) throw new Error("should reject conflict");
});

assert("different symbols in same file can be locked independently", () => {
  const lock = smMod.acquireSymbolLock({
    root: tmp,
    filePath: "src/utils.ts",
    symbol: "format",
    roleId: "architect",
    taskId: "t2",
  });
  if (!lock.id) throw new Error("should succeed for different symbol");
});

assert("releaseSymbolLock frees the lock", () => {
  if (typeof smMod.releaseSymbolLock !== "function") throw new Error("missing");
  smMod.releaseSymbolLock({ root: tmp, filePath: "src/utils.ts", symbol: "calculate", taskId: "t1" });
  // Should now be able to acquire
  const lock = smMod.acquireSymbolLock({
    root: tmp,
    filePath: "src/utils.ts",
    symbol: "calculate",
    roleId: "qa",
    taskId: "t3",
  });
  if (!lock.id) throw new Error("should succeed after release");
});

// ── Part 2: Worktree Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Worktree Manager\x1b[0m");

const wtLib = join(process.cwd(), "tools/ogu/commands/lib/worktree-manager.mjs");
assert("worktree-manager.mjs exists", () => {
  if (!existsSync(wtLib)) throw new Error("file missing");
});

const wtMod = await import(wtLib);

assert("planWorktree returns worktree creation plan", () => {
  if (typeof wtMod.planWorktree !== "function") throw new Error("missing");
  const plan = wtMod.planWorktree({
    root: tmp,
    featureSlug: "my-feature",
    roleId: "developer",
  });
  if (!plan.branch) throw new Error("no branch");
  if (!plan.path) throw new Error("no path");
  if (plan.featureSlug !== "my-feature") throw new Error("wrong feature");
});

assert("planWorktree generates unique branch names", () => {
  const p1 = wtMod.planWorktree({ root: tmp, featureSlug: "f1", roleId: "dev" });
  const p2 = wtMod.planWorktree({ root: tmp, featureSlug: "f1", roleId: "qa" });
  if (p1.branch === p2.branch) throw new Error("branches should differ per role");
});

assert("listWorktreePlans returns all planned worktrees", () => {
  if (typeof wtMod.listWorktreePlans !== "function") throw new Error("missing");
  const plans = wtMod.listWorktreePlans({ root: tmp });
  if (!Array.isArray(plans)) throw new Error("not array");
});

assert("worktree plan includes merge strategy", () => {
  const plan = wtMod.planWorktree({ root: tmp, featureSlug: "iso", roleId: "dev" });
  if (!plan.mergeStrategy) throw new Error("no merge strategy");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
