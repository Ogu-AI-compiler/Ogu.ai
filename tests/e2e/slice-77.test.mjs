/**
 * Slice 77 — Provenance Chain + Attestation
 *
 * Provenance: input→process→output chain tracking.
 * Attestation: cryptographic signing and verification of artifacts.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 77 — Provenance Chain + Attestation\x1b[0m\n");

// ── Part 1: Provenance Chain ──────────────────────────────

console.log("\x1b[36m  Part 1: Provenance Chain\x1b[0m");

const provLib = join(process.cwd(), "tools/ogu/commands/lib/provenance.mjs");
assert("provenance.mjs exists", () => {
  if (!existsSync(provLib)) throw new Error("file missing");
});

const provMod = await import(provLib);

assert("createProvenanceChain returns chain", () => {
  if (typeof provMod.createProvenanceChain !== "function") throw new Error("missing");
  const chain = provMod.createProvenanceChain();
  if (typeof chain.record !== "function") throw new Error("missing record");
  if (typeof chain.verify !== "function") throw new Error("missing verify");
  if (typeof chain.getChain !== "function") throw new Error("missing getChain");
});

assert("record adds entry to chain", () => {
  const chain = provMod.createProvenanceChain();
  chain.record({ input: "spec.md", process: "architect", output: "plan.json" });
  const entries = chain.getChain();
  if (entries.length !== 1) throw new Error(`expected 1, got ${entries.length}`);
  if (entries[0].input !== "spec.md") throw new Error("wrong input");
});

assert("each entry has hash linking to previous", () => {
  const chain = provMod.createProvenanceChain();
  chain.record({ input: "a", process: "p1", output: "b" });
  chain.record({ input: "b", process: "p2", output: "c" });
  const entries = chain.getChain();
  if (!entries[0].hash) throw new Error("first entry should have hash");
  if (!entries[1].hash) throw new Error("second entry should have hash");
  if (!entries[1].previousHash) throw new Error("second entry should link to first");
  if (entries[1].previousHash !== entries[0].hash) throw new Error("hash chain broken");
});

assert("verify returns true for valid chain", () => {
  const chain = provMod.createProvenanceChain();
  chain.record({ input: "x", process: "y", output: "z" });
  chain.record({ input: "z", process: "w", output: "q" });
  if (!chain.verify()) throw new Error("should be valid");
});

assert("getLineage traces back from an output", () => {
  if (typeof provMod.createProvenanceChain !== "function") throw new Error("missing");
  const chain = provMod.createProvenanceChain();
  chain.record({ input: "idea.md", process: "feature", output: "prd.md" });
  chain.record({ input: "prd.md", process: "architect", output: "spec.md" });
  chain.record({ input: "spec.md", process: "build", output: "code.mjs" });
  const lineage = chain.getLineage("code.mjs");
  if (lineage.length < 2) throw new Error("should have lineage entries");
});

// ── Part 2: Attestation ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Attestation\x1b[0m");

const attLib = join(process.cwd(), "tools/ogu/commands/lib/attestation.mjs");
assert("attestation.mjs exists", () => {
  if (!existsSync(attLib)) throw new Error("file missing");
});

const attMod = await import(attLib);

assert("createAttestation returns attestation object", () => {
  if (typeof attMod.createAttestation !== "function") throw new Error("missing");
  const att = attMod.createAttestation({
    subject: "gate-14",
    result: "pass",
    signer: "ogu-compiler",
  });
  if (!att.id) throw new Error("missing id");
  if (!att.signature) throw new Error("missing signature");
  if (!att.timestamp) throw new Error("missing timestamp");
});

assert("verifyAttestation returns true for valid attestation", () => {
  if (typeof attMod.verifyAttestation !== "function") throw new Error("missing");
  const att = attMod.createAttestation({
    subject: "compile",
    result: "success",
    signer: "ogu",
  });
  const valid = attMod.verifyAttestation(att);
  if (!valid) throw new Error("should be valid");
});

assert("verifyAttestation detects tampering", () => {
  const att = attMod.createAttestation({
    subject: "compile",
    result: "success",
    signer: "ogu",
  });
  att.result = "tampered";
  const valid = attMod.verifyAttestation(att);
  if (valid) throw new Error("should detect tampering");
});

assert("buildChain creates linked attestations", () => {
  if (typeof attMod.buildChain !== "function") throw new Error("missing");
  const items = [
    { subject: "gate-1", result: "pass", signer: "ogu" },
    { subject: "gate-2", result: "pass", signer: "ogu" },
    { subject: "gate-3", result: "pass", signer: "ogu" },
  ];
  const chain = attMod.buildChain(items);
  if (!Array.isArray(chain)) throw new Error("should return array");
  if (chain.length !== 3) throw new Error(`expected 3, got ${chain.length}`);
  if (!chain[1].previousId) throw new Error("second should reference first");
});

assert("ATTESTATION_TYPES exported", () => {
  if (!attMod.ATTESTATION_TYPES) throw new Error("missing");
  if (!Array.isArray(attMod.ATTESTATION_TYPES)) throw new Error("should be array");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
