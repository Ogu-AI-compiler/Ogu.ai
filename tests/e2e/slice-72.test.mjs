/**
 * Slice 72 — Secret Broker + Proposal Manager
 *
 * Secret broker: secret injection with TTL and audit trail.
 * Proposal manager: create, apply, and rollback proposals.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice72-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/proposals"), { recursive: true });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 72 — Secret Broker + Proposal Manager\x1b[0m\n");

// ── Part 1: Secret Broker ──────────────────────────────

console.log("\x1b[36m  Part 1: Secret Broker\x1b[0m");

const secLib = join(process.cwd(), "tools/ogu/commands/lib/secret-broker.mjs");
assert("secret-broker.mjs exists", () => {
  if (!existsSync(secLib)) throw new Error("file missing");
});

const secMod = await import(secLib);

assert("createSecretBroker returns broker", () => {
  if (typeof secMod.createSecretBroker !== "function") throw new Error("missing");
  const broker = secMod.createSecretBroker();
  if (typeof broker.issueSecret !== "function") throw new Error("missing issueSecret");
  if (typeof broker.getSecret !== "function") throw new Error("missing getSecret");
  if (typeof broker.revokeSecret !== "function") throw new Error("missing revokeSecret");
  if (typeof broker.listSecrets !== "function") throw new Error("missing listSecrets");
});

assert("issueSecret stores and getSecret retrieves", () => {
  const broker = secMod.createSecretBroker();
  broker.issueSecret("API_KEY", "sk-123", { ttlMs: 60000 });
  const val = broker.getSecret("API_KEY");
  if (val !== "sk-123") throw new Error(`expected sk-123, got ${val}`);
});

assert("revokeSecret removes secret", () => {
  const broker = secMod.createSecretBroker();
  broker.issueSecret("TOKEN", "tok-abc");
  broker.revokeSecret("TOKEN");
  const val = broker.getSecret("TOKEN");
  if (val !== null && val !== undefined) throw new Error("should be null after revoke");
});

assert("expired secrets return null", () => {
  const broker = secMod.createSecretBroker();
  broker.issueSecret("TEMP", "val", { ttlMs: -1 }); // Already expired
  const val = broker.getSecret("TEMP");
  if (val !== null && val !== undefined) throw new Error("expired secret should return null");
});

assert("listSecrets shows active secrets", () => {
  const broker = secMod.createSecretBroker();
  broker.issueSecret("A", "1");
  broker.issueSecret("B", "2");
  const list = broker.listSecrets();
  if (!Array.isArray(list)) throw new Error("should return array");
  if (list.length !== 2) throw new Error(`expected 2, got ${list.length}`);
});

assert("buildSecureEnv returns env object without expired", () => {
  if (typeof secMod.createSecretBroker !== "function") throw new Error("missing");
  const broker = secMod.createSecretBroker();
  broker.issueSecret("LIVE", "val1", { ttlMs: 60000 });
  broker.issueSecret("DEAD", "val2", { ttlMs: -1 });
  const env = broker.buildSecureEnv();
  if (env.LIVE !== "val1") throw new Error("should include live secret");
  if (env.DEAD) throw new Error("should not include expired secret");
});

assert("audit trail tracks operations", () => {
  const broker = secMod.createSecretBroker();
  broker.issueSecret("X", "1");
  broker.getSecret("X");
  broker.revokeSecret("X");
  const trail = broker.getAuditTrail();
  if (!Array.isArray(trail)) throw new Error("should return array");
  if (trail.length < 3) throw new Error(`expected at least 3 entries, got ${trail.length}`);
});

// ── Part 2: Proposal Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Proposal Manager\x1b[0m");

const propLib = join(process.cwd(), "tools/ogu/commands/lib/proposal-manager.mjs");
assert("proposal-manager.mjs exists", () => {
  if (!existsSync(propLib)) throw new Error("file missing");
});

const propMod = await import(propLib);

assert("createProposalManager returns manager", () => {
  if (typeof propMod.createProposalManager !== "function") throw new Error("missing");
  const mgr = propMod.createProposalManager({ root: tmp });
  if (typeof mgr.createProposal !== "function") throw new Error("missing createProposal");
  if (typeof mgr.applyProposal !== "function") throw new Error("missing applyProposal");
  if (typeof mgr.rollbackProposal !== "function") throw new Error("missing rollbackProposal");
});

assert("createProposal stores proposal", () => {
  const mgr = propMod.createProposalManager({ root: tmp });
  const id = mgr.createProposal({
    title: "Add auth module",
    changes: [{ type: "add", path: "src/auth.mjs", content: "export default {}" }],
  });
  if (typeof id !== "string" || id.length === 0) throw new Error("should return id");
  const proposal = mgr.getProposal(id);
  if (!proposal) throw new Error("should be retrievable");
  if (proposal.title !== "Add auth module") throw new Error("wrong title");
  if (proposal.status !== "pending") throw new Error("initial status should be pending");
});

assert("applyProposal marks as applied", () => {
  const mgr = propMod.createProposalManager({ root: tmp });
  const id = mgr.createProposal({
    title: "Add feature",
    changes: [{ type: "add", path: "src/feat.mjs", content: "// feat" }],
  });
  mgr.applyProposal(id);
  const p = mgr.getProposal(id);
  if (p.status !== "applied") throw new Error(`expected applied, got ${p.status}`);
});

assert("rollbackProposal marks as rolled back", () => {
  const mgr = propMod.createProposalManager({ root: tmp });
  const id = mgr.createProposal({
    title: "Risky change",
    changes: [{ type: "add", path: "src/risky.mjs", content: "// risky" }],
  });
  mgr.applyProposal(id);
  mgr.rollbackProposal(id);
  const p = mgr.getProposal(id);
  if (p.status !== "rolled_back") throw new Error(`expected rolled_back, got ${p.status}`);
});

assert("listProposals returns all proposals", () => {
  const mgr = propMod.createProposalManager({ root: tmp });
  mgr.createProposal({ title: "P1", changes: [] });
  mgr.createProposal({ title: "P2", changes: [] });
  const list = mgr.listProposals();
  if (!Array.isArray(list)) throw new Error("should be array");
  if (list.length < 2) throw new Error(`expected at least 2, got ${list.length}`);
});

assert("PROPOSAL_STATUSES exported", () => {
  if (!propMod.PROPOSAL_STATUSES) throw new Error("missing");
  if (!Array.isArray(propMod.PROPOSAL_STATUSES)) throw new Error("should be array");
  if (!propMod.PROPOSAL_STATUSES.includes("pending")) throw new Error("missing pending");
  if (!propMod.PROPOSAL_STATUSES.includes("applied")) throw new Error("missing applied");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
