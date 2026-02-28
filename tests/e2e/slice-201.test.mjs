/**
 * Slice 201 — Signal Handler + Process Manager
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 201 — Signal Handler + Process Manager\x1b[0m\n");

console.log("\x1b[36m  Part 1: Signal Handler\x1b[0m");
const shLib = join(process.cwd(), "tools/ogu/commands/lib/signal-handler.mjs");
assert("signal-handler.mjs exists", () => { if (!existsSync(shLib)) throw new Error("missing"); });
const shMod = await import(shLib);
assert("register and emit signal", () => {
  const sh = shMod.createSignalHandler();
  let called = false;
  sh.on("SIGTEST", () => { called = true; });
  sh.emit("SIGTEST");
  if (!called) throw new Error("handler not called");
});
assert("multiple handlers for same signal", () => {
  const sh = shMod.createSignalHandler();
  let count = 0;
  sh.on("SIG", () => count++);
  sh.on("SIG", () => count++);
  sh.emit("SIG");
  if (count !== 2) throw new Error(`expected 2, got ${count}`);
});
assert("off removes handler", () => {
  const sh = shMod.createSignalHandler();
  let count = 0;
  const handler = () => count++;
  sh.on("SIG", handler);
  sh.off("SIG", handler);
  sh.emit("SIG");
  if (count !== 0) throw new Error("should not be called");
});
assert("listSignals returns registered", () => {
  const sh = shMod.createSignalHandler();
  sh.on("A", () => {});
  sh.on("B", () => {});
  const signals = sh.listSignals();
  if (signals.length !== 2) throw new Error("expected 2 signals");
});

console.log("\n\x1b[36m  Part 2: Process Manager\x1b[0m");
const pmLib = join(process.cwd(), "tools/ogu/commands/lib/process-manager.mjs");
assert("process-manager.mjs exists", () => { if (!existsSync(pmLib)) throw new Error("missing"); });
const pmMod = await import(pmLib);
assert("spawn and list processes", () => {
  const pm = pmMod.createProcessManager();
  const pid = pm.spawn("worker", { cmd: "echo" });
  if (!pid) throw new Error("should return pid");
  const list = pm.list();
  if (list.length !== 1) throw new Error("expected 1 process");
});
assert("kill removes process", () => {
  const pm = pmMod.createProcessManager();
  const pid = pm.spawn("worker", {});
  pm.kill(pid);
  if (pm.list().length !== 0) throw new Error("should be empty");
});
assert("getStatus returns process info", () => {
  const pm = pmMod.createProcessManager();
  const pid = pm.spawn("test", { env: "dev" });
  const status = pm.getStatus(pid);
  if (status.name !== "test") throw new Error("wrong name");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
