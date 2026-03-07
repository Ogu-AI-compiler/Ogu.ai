/**
 * Slice 80 — Storage Adapter
 *
 * Storage adapter: pluggable storage layer (filesystem backend).

 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice80-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 80 — Storage Adapter\x1b[0m\n");

// ── Part 1: Storage Adapter ──────────────────────────────

console.log("\x1b[36m  Part 1: Storage Adapter\x1b[0m");

const stLib = join(process.cwd(), "tools/ogu/commands/lib/storage-adapter.mjs");
assert("storage-adapter.mjs exists", () => {
  if (!existsSync(stLib)) throw new Error("file missing");
});

const stMod = await import(stLib);

assert("createFileStorage returns adapter", () => {
  if (typeof stMod.createFileStorage !== "function") throw new Error("missing");
  const storage = stMod.createFileStorage({ root: tmp });
  if (typeof storage.write !== "function") throw new Error("missing write");
  if (typeof storage.read !== "function") throw new Error("missing read");
  if (typeof storage.exists !== "function") throw new Error("missing exists");
  if (typeof storage.remove !== "function") throw new Error("missing remove");
});

assert("write and read round-trip", () => {
  const storage = stMod.createFileStorage({ root: tmp });
  storage.write("test/data.json", JSON.stringify({ key: "value" }));
  const content = storage.read("test/data.json");
  const parsed = JSON.parse(content);
  if (parsed.key !== "value") throw new Error("round-trip failed");
});

assert("exists checks file existence", () => {
  const storage = stMod.createFileStorage({ root: tmp });
  storage.write("exists.txt", "hello");
  if (!storage.exists("exists.txt")) throw new Error("should exist");
  if (storage.exists("nope.txt")) throw new Error("should not exist");
});

assert("remove deletes file", () => {
  const storage = stMod.createFileStorage({ root: tmp });
  storage.write("del.txt", "bye");
  storage.remove("del.txt");
  if (storage.exists("del.txt")) throw new Error("should be deleted");
});

assert("list returns files in directory", () => {
  const storage = stMod.createFileStorage({ root: tmp });
  storage.write("dir/a.txt", "a");
  storage.write("dir/b.txt", "b");
  const files = storage.list("dir");
  if (!Array.isArray(files)) throw new Error("should return array");
  if (files.length < 2) throw new Error(`expected at least 2, got ${files.length}`);
});

assert("STORAGE_BACKENDS exported", () => {
  if (!stMod.STORAGE_BACKENDS) throw new Error("missing");
  if (!Array.isArray(stMod.STORAGE_BACKENDS)) throw new Error("should be array");
  if (!stMod.STORAGE_BACKENDS.includes("filesystem")) throw new Error("missing filesystem");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
