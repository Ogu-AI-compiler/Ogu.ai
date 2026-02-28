/**
 * Slice 152 — File Watcher Simulator + Hot Reload Manager
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 152 — File Watcher Simulator + Hot Reload Manager\x1b[0m\n");

console.log("\x1b[36m  Part 1: File Watcher Simulator\x1b[0m");

const fwLib = join(process.cwd(), "tools/ogu/commands/lib/file-watcher-sim.mjs");
assert("file-watcher-sim.mjs exists", () => { if (!existsSync(fwLib)) throw new Error("file missing"); });
const fwMod = await import(fwLib);

assert("createFileWatcher returns watcher", () => {
  if (typeof fwMod.createFileWatcher !== "function") throw new Error("missing");
  const watcher = fwMod.createFileWatcher();
  if (typeof watcher.watch !== "function") throw new Error("missing watch");
  if (typeof watcher.emit !== "function") throw new Error("missing emit");
});

assert("watch and emit delivers change events", () => {
  const watcher = fwMod.createFileWatcher();
  const events = [];
  watcher.watch("src/**/*.ts", (e) => events.push(e));
  watcher.emit({ type: "change", path: "src/app.ts" });
  if (events.length !== 1) throw new Error(`expected 1, got ${events.length}`);
});

assert("pattern filtering works", () => {
  const watcher = fwMod.createFileWatcher();
  const events = [];
  watcher.watch("src/**", (e) => events.push(e));
  watcher.emit({ type: "change", path: "src/app.ts" });
  watcher.emit({ type: "change", path: "docs/readme.md" });
  if (events.length !== 1) throw new Error(`expected 1, got ${events.length}`);
});

assert("unwatch stops delivery", () => {
  const watcher = fwMod.createFileWatcher();
  const events = [];
  const id = watcher.watch("**", (e) => events.push(e));
  watcher.emit({ type: "change", path: "a.ts" });
  watcher.unwatch(id);
  watcher.emit({ type: "change", path: "b.ts" });
  if (events.length !== 1) throw new Error(`expected 1, got ${events.length}`);
});

console.log("\n\x1b[36m  Part 2: Hot Reload Manager\x1b[0m");

const hrLib = join(process.cwd(), "tools/ogu/commands/lib/hot-reload-manager.mjs");
assert("hot-reload-manager.mjs exists", () => { if (!existsSync(hrLib)) throw new Error("file missing"); });
const hrMod = await import(hrLib);

assert("createHotReloadManager returns manager", () => {
  if (typeof hrMod.createHotReloadManager !== "function") throw new Error("missing");
  const mgr = hrMod.createHotReloadManager();
  if (typeof mgr.register !== "function") throw new Error("missing register");
  if (typeof mgr.triggerReload !== "function") throw new Error("missing triggerReload");
});

assert("triggerReload calls registered handlers", () => {
  const mgr = hrMod.createHotReloadManager();
  const reloaded = [];
  mgr.register("module-a", () => reloaded.push("a"));
  mgr.register("module-b", () => reloaded.push("b"));
  mgr.triggerReload("module-a");
  if (reloaded.length !== 1) throw new Error(`expected 1, got ${reloaded.length}`);
  if (reloaded[0] !== "a") throw new Error("wrong module reloaded");
});

assert("getReloadCount tracks reloads", () => {
  const mgr = hrMod.createHotReloadManager();
  mgr.register("x", () => {});
  mgr.triggerReload("x");
  mgr.triggerReload("x");
  if (mgr.getReloadCount("x") !== 2) throw new Error("expected 2 reloads");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
