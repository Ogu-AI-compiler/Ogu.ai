/**
 * Slice 161 — Audit Trail Integrity + Audit Seal
 *
 * Audit Trail Integrity: verify audit log chain integrity with hash chaining.
 * Audit Seal: generate and verify seals on audit entries.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 161 — Audit Trail Integrity + Audit Seal\x1b[0m\n");

// ── Part 1: Audit Trail Integrity ──────────────────────────────

console.log("\x1b[36m  Part 1: Audit Trail Integrity\x1b[0m");

const atiLib = join(process.cwd(), "tools/ogu/commands/lib/audit-trail-integrity.mjs");
assert("audit-trail-integrity.mjs exists", () => {
  if (!existsSync(atiLib)) throw new Error("file missing");
});

const atiMod = await import(atiLib);

assert("createAuditChain returns chain", () => {
  if (typeof atiMod.createAuditChain !== "function") throw new Error("missing");
  const chain = atiMod.createAuditChain();
  if (typeof chain.append !== "function") throw new Error("missing append");
  if (typeof chain.verify !== "function") throw new Error("missing verify");
  if (typeof chain.getEntries !== "function") throw new Error("missing getEntries");
});

assert("append adds entry with hash", () => {
  const chain = atiMod.createAuditChain();
  const entry = chain.append({ action: "create", resource: "user-1" });
  if (!entry.hash) throw new Error("missing hash");
  if (entry.index !== 0) throw new Error(`expected index 0, got ${entry.index}`);
});

assert("entries form hash chain", () => {
  const chain = atiMod.createAuditChain();
  chain.append({ action: "a" });
  const e2 = chain.append({ action: "b" });
  if (!e2.prevHash) throw new Error("should reference previous hash");
});

assert("verify returns true for valid chain", () => {
  const chain = atiMod.createAuditChain();
  chain.append({ action: "x" });
  chain.append({ action: "y" });
  chain.append({ action: "z" });
  if (!chain.verify()) throw new Error("valid chain should verify");
});

assert("tampered chain fails verification", () => {
  const chain = atiMod.createAuditChain();
  chain.append({ action: "x" });
  chain.append({ action: "y" });
  // tamper
  const entries = chain.getEntries();
  entries[0].data.action = "tampered";
  if (chain.verify()) throw new Error("tampered chain should fail");
});

// ── Part 2: Audit Seal ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Audit Seal\x1b[0m");

const asLib = join(process.cwd(), "tools/ogu/commands/lib/audit-seal.mjs");
assert("audit-seal.mjs exists", () => {
  if (!existsSync(asLib)) throw new Error("file missing");
});

const asMod = await import(asLib);

assert("createAuditSealer returns sealer", () => {
  if (typeof asMod.createAuditSealer !== "function") throw new Error("missing");
  const sealer = asMod.createAuditSealer({ secret: "test-key" });
  if (typeof sealer.seal !== "function") throw new Error("missing seal");
  if (typeof sealer.verify !== "function") throw new Error("missing verify");
});

assert("seal produces signature", () => {
  const sealer = asMod.createAuditSealer({ secret: "key" });
  const sealed = sealer.seal({ action: "deploy", by: "agent-1" });
  if (!sealed.signature) throw new Error("missing signature");
  if (typeof sealed.signature !== "string") throw new Error("signature should be string");
});

assert("verify accepts valid seal", () => {
  const sealer = asMod.createAuditSealer({ secret: "key" });
  const sealed = sealer.seal({ action: "deploy" });
  if (!sealer.verify(sealed)) throw new Error("valid seal should verify");
});

assert("verify rejects tampered seal", () => {
  const sealer = asMod.createAuditSealer({ secret: "key" });
  const sealed = sealer.seal({ action: "deploy" });
  sealed.data.action = "tampered";
  if (sealer.verify(sealed)) throw new Error("tampered should fail");
});

assert("different secrets produce different signatures", () => {
  const s1 = asMod.createAuditSealer({ secret: "key1" });
  const s2 = asMod.createAuditSealer({ secret: "key2" });
  const sealed1 = s1.seal({ x: 1 });
  const sealed2 = s2.seal({ x: 1 });
  if (sealed1.signature === sealed2.signature) throw new Error("should differ");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
