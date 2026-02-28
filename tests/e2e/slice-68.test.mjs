/**
 * Slice 68 — Cache Manager + TTL Store
 *
 * Cache manager: LRU cache with configurable max size.
 * TTL store: key-value store with time-to-live expiration.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice68-${Date.now()}`);
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

console.log("\n\x1b[1mSlice 68 — Cache Manager + TTL Store\x1b[0m\n");

// ── Part 1: Cache Manager (LRU) ──────────────────────────────

console.log("\x1b[36m  Part 1: LRU Cache Manager\x1b[0m");

const cacheLib = join(process.cwd(), "tools/ogu/commands/lib/cache-manager.mjs");
assert("cache-manager.mjs exists", () => {
  if (!existsSync(cacheLib)) throw new Error("file missing");
});

const cacheMod = await import(cacheLib);

assert("createLRUCache returns cache", () => {
  if (typeof cacheMod.createLRUCache !== "function") throw new Error("missing");
  const c = cacheMod.createLRUCache({ maxSize: 3 });
  if (typeof c.get !== "function") throw new Error("missing get");
  if (typeof c.set !== "function") throw new Error("missing set");
  if (typeof c.has !== "function") throw new Error("missing has");
  if (typeof c.size !== "function") throw new Error("missing size");
});

assert("set and get store/retrieve values", () => {
  const c = cacheMod.createLRUCache({ maxSize: 10 });
  c.set("key1", "value1");
  c.set("key2", { complex: true });
  if (c.get("key1") !== "value1") throw new Error("wrong value");
  if (!c.get("key2").complex) throw new Error("wrong object value");
});

assert("evicts least recently used when full", () => {
  const c = cacheMod.createLRUCache({ maxSize: 2 });
  c.set("a", 1);
  c.set("b", 2);
  c.set("c", 3); // Should evict 'a'
  if (c.has("a")) throw new Error("a should be evicted");
  if (!c.has("b")) throw new Error("b should still exist");
  if (!c.has("c")) throw new Error("c should exist");
});

assert("get refreshes item for LRU ordering", () => {
  const c = cacheMod.createLRUCache({ maxSize: 2 });
  c.set("a", 1);
  c.set("b", 2);
  c.get("a"); // Refresh 'a', so 'b' is now LRU
  c.set("c", 3); // Should evict 'b'
  if (!c.has("a")) throw new Error("a should exist (refreshed)");
  if (c.has("b")) throw new Error("b should be evicted");
});

assert("delete removes entry", () => {
  const c = cacheMod.createLRUCache({ maxSize: 10 });
  c.set("x", 1);
  if (typeof c.delete !== "function") throw new Error("missing delete");
  c.delete("x");
  if (c.has("x")) throw new Error("should be deleted");
});

// ── Part 2: TTL Store ──────────────────────────────

console.log("\n\x1b[36m  Part 2: TTL Store\x1b[0m");

const ttlLib = join(process.cwd(), "tools/ogu/commands/lib/ttl-store.mjs");
assert("ttl-store.mjs exists", () => {
  if (!existsSync(ttlLib)) throw new Error("file missing");
});

const ttlMod = await import(ttlLib);

assert("createTTLStore returns store", () => {
  if (typeof ttlMod.createTTLStore !== "function") throw new Error("missing");
  const s = ttlMod.createTTLStore();
  if (typeof s.set !== "function") throw new Error("missing set");
  if (typeof s.get !== "function") throw new Error("missing get");
  if (typeof s.has !== "function") throw new Error("missing has");
});

assert("set with TTL and get before expiry", () => {
  const s = ttlMod.createTTLStore();
  s.set("session", "abc123", { ttlMs: 60000 });
  if (s.get("session") !== "abc123") throw new Error("should retrieve before expiry");
});

assert("expired entries return undefined", () => {
  const s = ttlMod.createTTLStore();
  s.set("temp", "data", { ttlMs: -1 }); // Already expired
  if (s.get("temp") !== undefined) throw new Error("should be expired");
});

assert("has returns false for expired entries", () => {
  const s = ttlMod.createTTLStore();
  s.set("gone", "data", { ttlMs: -1 });
  if (s.has("gone")) throw new Error("should be false for expired");
});

assert("cleanup removes expired entries", () => {
  const s = ttlMod.createTTLStore();
  s.set("alive", "yes", { ttlMs: 60000 });
  s.set("dead1", "no", { ttlMs: -1 });
  s.set("dead2", "no", { ttlMs: -1 });
  if (typeof s.cleanup !== "function") throw new Error("missing cleanup");
  const removed = s.cleanup();
  if (removed < 2) throw new Error(`expected 2 cleaned, got ${removed}`);
});

assert("size returns count of non-expired entries", () => {
  const s = ttlMod.createTTLStore();
  s.set("a", 1, { ttlMs: 60000 });
  s.set("b", 2, { ttlMs: 60000 });
  s.set("c", 3, { ttlMs: -1 }); // expired
  if (typeof s.size !== "function") throw new Error("missing size");
  if (s.size() !== 2) throw new Error(`expected 2, got ${s.size()}`);
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
