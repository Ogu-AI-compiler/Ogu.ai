/**
 * Slice 41 — File Mutex in Build-Parallel (P42) + Semantic Memory Fabric (P36)
 *
 * File Mutex: Runtime file locking during parallel builds to prevent conflicts.
 * Semantic Memory: File-based RAG-like memory with tags, search, and relevance scoring.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice41-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/memory"), { recursive: true });
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

console.log("\n\x1b[1mSlice 41 — File Mutex + Semantic Memory Fabric\x1b[0m\n");
console.log("  Runtime file locks, RAG-like semantic memory\n");

// ── Part 1: File Mutex ──────────────────────────────

console.log("\x1b[36m  Part 1: File Mutex for Build-Parallel\x1b[0m");

const mutexLib = join(process.cwd(), "tools/ogu/commands/lib/file-mutex.mjs");
assert("file-mutex.mjs exists", () => {
  if (!existsSync(mutexLib)) throw new Error("file missing");
});

const mutexMod = await import(mutexLib);

assert("acquireFileLock locks a file for a task", () => {
  if (typeof mutexMod.acquireFileLock !== "function") throw new Error("missing");
  const lock = mutexMod.acquireFileLock({
    root: tmp,
    filePath: "src/auth.ts",
    taskId: "t1",
    roleId: "developer",
  });
  if (!lock.id) throw new Error("no lock id");
  if (lock.filePath !== "src/auth.ts") throw new Error("wrong path");
});

assert("acquireFileLock rejects conflicting lock", () => {
  let threw = false;
  try {
    mutexMod.acquireFileLock({
      root: tmp,
      filePath: "src/auth.ts",
      taskId: "t2",
      roleId: "tester",
    });
  } catch (e) {
    threw = true;
    if (!e.message.includes("locked")) throw new Error("wrong error: " + e.message);
  }
  if (!threw) throw new Error("should throw on conflict");
});

assert("acquireFileLock allows same task to re-acquire", () => {
  const lock = mutexMod.acquireFileLock({
    root: tmp,
    filePath: "src/auth.ts",
    taskId: "t1",
    roleId: "developer",
  });
  if (!lock) throw new Error("should allow re-acquire");
});

assert("releaseFileLock releases a lock", () => {
  if (typeof mutexMod.releaseFileLock !== "function") throw new Error("missing");
  const result = mutexMod.releaseFileLock({
    root: tmp,
    filePath: "src/auth.ts",
    taskId: "t1",
  });
  if (!result) throw new Error("should return true");
});

assert("listFileLocks returns active locks", () => {
  if (typeof mutexMod.listFileLocks !== "function") throw new Error("missing");
  mutexMod.acquireFileLock({ root: tmp, filePath: "src/a.ts", taskId: "t3", roleId: "dev" });
  mutexMod.acquireFileLock({ root: tmp, filePath: "src/b.ts", taskId: "t4", roleId: "dev" });
  const locks = mutexMod.listFileLocks({ root: tmp });
  if (locks.length < 2) throw new Error(`expected at least 2, got ${locks.length}`);
});

assert("releaseAllLocks clears all locks for a task", () => {
  if (typeof mutexMod.releaseAllLocks !== "function") throw new Error("missing");
  mutexMod.releaseAllLocks({ root: tmp, taskId: "t3" });
  const locks = mutexMod.listFileLocks({ root: tmp });
  const t3Locks = locks.filter(l => l.taskId === "t3");
  if (t3Locks.length > 0) throw new Error("should have released t3 locks");
});

// ── Part 2: Semantic Memory Fabric ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Semantic Memory Fabric\x1b[0m");

const memLib = join(process.cwd(), "tools/ogu/commands/lib/semantic-memory.mjs");
assert("semantic-memory.mjs exists", () => {
  if (!existsSync(memLib)) throw new Error("file missing");
});

const memMod = await import(memLib);

assert("storeMemory saves a memory entry with tags", () => {
  if (typeof memMod.storeMemory !== "function") throw new Error("missing");
  const entry = memMod.storeMemory({
    root: tmp,
    content: "Always use Zod for runtime validation of external data",
    tags: ["validation", "zod", "patterns"],
    source: "feature:auth",
    category: "pattern",
  });
  if (!entry.id) throw new Error("no id");
  if (entry.tags.length !== 3) throw new Error("wrong tags count");
});

assert("storeMemory saves multiple entries", () => {
  memMod.storeMemory({
    root: tmp,
    content: "Use circuit breakers for external API calls to prevent cascade failures",
    tags: ["resilience", "circuit-breaker", "api"],
    source: "feature:payments",
    category: "pattern",
  });
  memMod.storeMemory({
    root: tmp,
    content: "Auth tokens should be stored in httpOnly cookies, never localStorage",
    tags: ["security", "auth", "cookies"],
    source: "feature:auth",
    category: "decision",
  });
});

assert("searchMemory finds entries by tag", () => {
  if (typeof memMod.searchMemory !== "function") throw new Error("missing");
  const results = memMod.searchMemory({ root: tmp, tags: ["auth"] });
  if (results.length < 1) throw new Error("expected at least 1 result");
});

assert("searchMemory finds entries by keyword", () => {
  const results = memMod.searchMemory({ root: tmp, query: "circuit breaker" });
  if (results.length < 1) throw new Error("expected at least 1 result");
});

assert("searchMemory scores results by relevance", () => {
  const results = memMod.searchMemory({ root: tmp, query: "validation", tags: ["zod"] });
  if (results.length < 1) throw new Error("no results");
  if (typeof results[0].score !== "number") throw new Error("no score");
  if (results[0].score <= 0) throw new Error("score should be positive");
});

assert("listMemories returns all entries", () => {
  if (typeof memMod.listMemories !== "function") throw new Error("missing");
  const all = memMod.listMemories({ root: tmp });
  if (all.length < 3) throw new Error(`expected at least 3, got ${all.length}`);
});

assert("deleteMemory removes an entry", () => {
  if (typeof memMod.deleteMemory !== "function") throw new Error("missing");
  const all = memMod.listMemories({ root: tmp });
  const id = all[0].id;
  memMod.deleteMemory({ root: tmp, id });
  const after = memMod.listMemories({ root: tmp });
  if (after.length >= all.length) throw new Error("should have fewer entries");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
