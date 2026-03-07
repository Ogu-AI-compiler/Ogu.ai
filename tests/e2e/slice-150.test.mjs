/**
 * Slice 150 — Error Recovery Manager
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 150 — Error Recovery Manager\x1b[0m\n");

console.log("\x1b[36m  Part 1: Error Recovery Manager\x1b[0m");

const ermLib = join(process.cwd(), "tools/ogu/commands/lib/error-recovery-manager.mjs");
assert("error-recovery-manager.mjs exists", () => { if (!existsSync(ermLib)) throw new Error("file missing"); });

const ermMod = await import(ermLib);

assert("createErrorRecoveryManager returns manager", () => {
  if (typeof ermMod.createErrorRecoveryManager !== "function") throw new Error("missing");
  const mgr = ermMod.createErrorRecoveryManager();
  if (typeof mgr.addStrategy !== "function") throw new Error("missing addStrategy");
  if (typeof mgr.recover !== "function") throw new Error("missing recover");
});

assert("recover uses matching strategy", () => {
  const mgr = ermMod.createErrorRecoveryManager();
  mgr.addStrategy({ pattern: /ECONNREFUSED/, action: "retry", maxAttempts: 3 });
  const result = mgr.recover(new Error("ECONNREFUSED 127.0.0.1:3000"));
  if (result.action !== "retry") throw new Error(`expected retry, got ${result.action}`);
});

assert("recover returns escalate for unknown errors", () => {
  const mgr = ermMod.createErrorRecoveryManager();
  const result = mgr.recover(new Error("something random"));
  if (result.action !== "escalate") throw new Error(`expected escalate, got ${result.action}`);
});

assert("recover tracks error history", () => {
  const mgr = ermMod.createErrorRecoveryManager();
  mgr.recover(new Error("err1"));
  mgr.recover(new Error("err2"));
  const history = mgr.getHistory();
  if (history.length !== 2) throw new Error(`expected 2, got ${history.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
