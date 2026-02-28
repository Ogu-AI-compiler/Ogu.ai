/**
 * Slice 207 — Undo Manager + Command History
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 207 — Undo Manager + Command History\x1b[0m\n");

console.log("\x1b[36m  Part 1: Undo Manager\x1b[0m");
const umLib = join(process.cwd(), "tools/ogu/commands/lib/undo-manager.mjs");
assert("undo-manager.mjs exists", () => { if (!existsSync(umLib)) throw new Error("missing"); });
const umMod = await import(umLib);
assert("execute and undo", () => {
  const um = umMod.createUndoManager();
  let value = 0;
  um.execute({ do: () => { value = 10; }, undo: () => { value = 0; } });
  if (value !== 10) throw new Error("should be 10");
  um.undo();
  if (value !== 0) throw new Error("should be 0");
});
assert("redo works", () => {
  const um = umMod.createUndoManager();
  let value = 0;
  um.execute({ do: () => { value = 5; }, undo: () => { value = 0; } });
  um.undo(); um.redo();
  if (value !== 5) throw new Error("should be 5");
});
assert("canUndo and canRedo", () => {
  const um = umMod.createUndoManager();
  if (um.canUndo()) throw new Error("should not canUndo");
  um.execute({ do: () => {}, undo: () => {} });
  if (!um.canUndo()) throw new Error("should canUndo");
  if (um.canRedo()) throw new Error("should not canRedo");
  um.undo();
  if (!um.canRedo()) throw new Error("should canRedo");
});

console.log("\n\x1b[36m  Part 2: Command History\x1b[0m");
const chLib = join(process.cwd(), "tools/ogu/commands/lib/command-history.mjs");
assert("command-history.mjs exists", () => { if (!existsSync(chLib)) throw new Error("missing"); });
const chMod = await import(chLib);
assert("add and list commands", () => {
  const ch = chMod.createCommandHistory();
  ch.add("ls"); ch.add("cd /tmp"); ch.add("pwd");
  if (ch.list().length !== 3) throw new Error("expected 3");
});
assert("search finds matching", () => {
  const ch = chMod.createCommandHistory();
  ch.add("git status"); ch.add("git log"); ch.add("npm test");
  const results = ch.search("git");
  if (results.length !== 2) throw new Error(`expected 2, got ${results.length}`);
});
assert("getLast returns most recent", () => {
  const ch = chMod.createCommandHistory();
  ch.add("first"); ch.add("second"); ch.add("third");
  if (ch.getLast() !== "third") throw new Error("should be third");
});
assert("clear empties history", () => {
  const ch = chMod.createCommandHistory();
  ch.add("a"); ch.add("b");
  ch.clear();
  if (ch.list().length !== 0) throw new Error("should be empty");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
