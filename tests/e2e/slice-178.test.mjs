/**
 * Slice 178 — Capability Negotiator + Protocol Version Manager
 *
 * Capability Negotiator: negotiate capabilities between peers.
 * Protocol Version Manager: manage protocol version compatibility.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 178 — Capability Negotiator + Protocol Version Manager\x1b[0m\n");

// ── Part 1: Capability Negotiator ──────────────────────────────

console.log("\x1b[36m  Part 1: Capability Negotiator\x1b[0m");

const cnLib = join(process.cwd(), "tools/ogu/commands/lib/capability-negotiator.mjs");
assert("capability-negotiator.mjs exists", () => {
  if (!existsSync(cnLib)) throw new Error("file missing");
});

const cnMod = await import(cnLib);

assert("negotiate returns common capabilities", () => {
  if (typeof cnMod.negotiate !== "function") throw new Error("missing");
  const result = cnMod.negotiate(
    ["streaming", "compression", "auth"],
    ["compression", "auth", "encryption"]
  );
  if (result.length !== 2) throw new Error(`expected 2, got ${result.length}`);
  if (!result.includes("compression")) throw new Error("missing compression");
  if (!result.includes("auth")) throw new Error("missing auth");
});

assert("negotiate returns empty for no overlap", () => {
  const result = cnMod.negotiate(["a", "b"], ["c", "d"]);
  if (result.length !== 0) throw new Error("should be empty");
});

assert("negotiateWithPriority picks highest priority", () => {
  if (typeof cnMod.negotiateWithPriority !== "function") throw new Error("missing");
  const result = cnMod.negotiateWithPriority(
    [{ name: "gzip", priority: 2 }, { name: "brotli", priority: 1 }],
    [{ name: "brotli", priority: 1 }, { name: "gzip", priority: 3 }]
  );
  if (result.name !== "gzip") throw new Error(`expected gzip, got ${result.name}`);
});

assert("isCompatible checks capability presence", () => {
  if (typeof cnMod.isCompatible !== "function") throw new Error("missing");
  if (!cnMod.isCompatible(["auth", "stream"], ["auth"])) throw new Error("should be compatible");
  if (cnMod.isCompatible(["auth"], ["auth", "required-feature"])) throw new Error("should not be compatible");
});

// ── Part 2: Protocol Version Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Protocol Version Manager\x1b[0m");

const pvLib = join(process.cwd(), "tools/ogu/commands/lib/protocol-version-manager.mjs");
assert("protocol-version-manager.mjs exists", () => {
  if (!existsSync(pvLib)) throw new Error("file missing");
});

const pvMod = await import(pvLib);

assert("createVersionManager returns manager", () => {
  if (typeof pvMod.createVersionManager !== "function") throw new Error("missing");
  const vm = pvMod.createVersionManager();
  if (typeof vm.register !== "function") throw new Error("missing register");
  if (typeof vm.isCompatible !== "function") throw new Error("missing isCompatible");
});

assert("register adds version", () => {
  const vm = pvMod.createVersionManager();
  vm.register({ version: "1.0", minCompatible: "1.0" });
  vm.register({ version: "2.0", minCompatible: "1.0" });
  const versions = vm.listVersions();
  if (versions.length !== 2) throw new Error(`expected 2, got ${versions.length}`);
});

assert("isCompatible checks version range", () => {
  const vm = pvMod.createVersionManager();
  vm.register({ version: "2.0", minCompatible: "1.0" });
  if (!vm.isCompatible("2.0", "1.5")) throw new Error("2.0 should be compat with 1.5");
  if (vm.isCompatible("2.0", "0.9")) throw new Error("2.0 should not be compat with 0.9");
});

assert("getLatest returns highest version", () => {
  const vm = pvMod.createVersionManager();
  vm.register({ version: "1.0", minCompatible: "1.0" });
  vm.register({ version: "3.0", minCompatible: "2.0" });
  vm.register({ version: "2.0", minCompatible: "1.0" });
  if (vm.getLatest() !== "3.0") throw new Error(`expected 3.0, got ${vm.getLatest()}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
