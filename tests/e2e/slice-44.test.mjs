/**
 * Slice 44 — Studio API Extensions + Event Envelope (P20 backend + P20-P28 prep)
 *
 * Studio API: new endpoints for org, agents, budget, governance, audit.
 * Event Envelope: StudioEventEnvelope type and serialization.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice44-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/budget"), { recursive: true });
mkdirSync(join(tmp, ".ogu/approvals"), { recursive: true });
mkdirSync(join(tmp, ".ogu/agents/sessions"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");
writeFileSync(join(tmp, ".ogu/budget/budget-state.json"), JSON.stringify({
  daily: { spent: 5.20, limit: 100 },
  monthly: { spent: 42.50, limit: 2000 },
}));
writeFileSync(join(tmp, ".ogu/OrgSpec.json"), JSON.stringify({
  company: "TestCo",
  roles: [
    { id: "developer", name: "Developer", capabilities: ["code", "test"] },
    { id: "reviewer", name: "Reviewer", capabilities: ["review"] },
  ],
  providers: [
    { id: "anthropic", name: "Anthropic", models: ["claude-sonnet"] },
  ],
  budget: { dailyLimit: 100, monthlyLimit: 2000 },
  governance: { policies: [] },
}, null, 2));

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 44 — Studio API Extensions + Event Envelope\x1b[0m\n");
console.log("  Backend APIs for Studio panels, event envelopes\n");

// ── Part 1: Studio Data Provider ──────────────────────────────

console.log("\x1b[36m  Part 1: Studio Data Provider\x1b[0m");

const providerLib = join(process.cwd(), "tools/ogu/commands/lib/studio-data-provider.mjs");
assert("studio-data-provider.mjs exists", () => {
  if (!existsSync(providerLib)) throw new Error("file missing");
});

const providerMod = await import(providerLib);

assert("getOrgData returns organization summary", () => {
  if (typeof providerMod.getOrgData !== "function") throw new Error("missing");
  const data = providerMod.getOrgData({ root: tmp });
  if (!data.company) throw new Error("no company");
  if (!Array.isArray(data.roles)) throw new Error("no roles");
  if (data.roles.length < 2) throw new Error("expected 2 roles");
});

assert("getBudgetData returns budget summary", () => {
  if (typeof providerMod.getBudgetData !== "function") throw new Error("missing");
  const data = providerMod.getBudgetData({ root: tmp });
  if (typeof data.daily !== "object") throw new Error("no daily");
  if (typeof data.monthly !== "object") throw new Error("no monthly");
  if (data.daily.spent !== 5.20) throw new Error("wrong daily spent");
});

assert("getAuditData returns recent audit events", () => {
  if (typeof providerMod.getAuditData !== "function") throw new Error("missing");
  // Write some test audit events
  const events = [
    { id: "e1", type: "task.started", timestamp: new Date().toISOString(), payload: {} },
    { id: "e2", type: "task.completed", timestamp: new Date().toISOString(), payload: {} },
  ];
  writeFileSync(
    join(tmp, ".ogu/audit/current.jsonl"),
    events.map(e => JSON.stringify(e)).join("\n") + "\n"
  );
  const data = providerMod.getAuditData({ root: tmp, limit: 10 });
  if (!Array.isArray(data.events)) throw new Error("no events");
  if (data.events.length < 2) throw new Error("expected at least 2 events");
});

assert("getGovernanceData returns governance state", () => {
  if (typeof providerMod.getGovernanceData !== "function") throw new Error("missing");
  const data = providerMod.getGovernanceData({ root: tmp });
  if (!Array.isArray(data.pendingApprovals)) throw new Error("no pendingApprovals");
  if (!Array.isArray(data.policies)) throw new Error("no policies");
});

assert("getAgentData returns agent sessions", () => {
  if (typeof providerMod.getAgentData !== "function") throw new Error("missing");
  const data = providerMod.getAgentData({ root: tmp });
  if (!Array.isArray(data.sessions)) throw new Error("no sessions");
  if (!Array.isArray(data.roles)) throw new Error("no roles");
});

assert("getDashboardSnapshot returns full dashboard data", () => {
  if (typeof providerMod.getDashboardSnapshot !== "function") throw new Error("missing");
  const snapshot = providerMod.getDashboardSnapshot({ root: tmp });
  if (!snapshot.org) throw new Error("no org");
  if (!snapshot.budget) throw new Error("no budget");
  if (!snapshot.audit) throw new Error("no audit");
  if (!snapshot.governance) throw new Error("no governance");
  if (!snapshot.agents) throw new Error("no agents");
  if (!snapshot.timestamp) throw new Error("no timestamp");
});

// ── Part 2: Studio Event Envelope ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Studio Event Envelope\x1b[0m");

const envelopeLib = join(process.cwd(), "tools/ogu/commands/lib/studio-event-envelope.mjs");
assert("studio-event-envelope.mjs exists", () => {
  if (!existsSync(envelopeLib)) throw new Error("file missing");
});

const envMod = await import(envelopeLib);

assert("createEventEnvelope creates sequenced event", () => {
  if (typeof envMod.createEventEnvelope !== "function") throw new Error("missing");
  const env = envMod.createEventEnvelope({
    type: "budget.updated",
    streamKey: "budget",
    payload: { daily: { spent: 5.20 } },
    priority: "normal",
  });
  if (typeof env.seq !== "number") throw new Error("no seq");
  if (!env.id) throw new Error("no id");
  if (env.type !== "budget.updated") throw new Error("wrong type");
  if (env.streamKey !== "budget") throw new Error("wrong streamKey");
  if (!env.timestamp) throw new Error("no timestamp");
});

assert("createEventEnvelope auto-increments seq", () => {
  const e1 = envMod.createEventEnvelope({ type: "a", streamKey: "test", payload: {} });
  const e2 = envMod.createEventEnvelope({ type: "b", streamKey: "test", payload: {} });
  if (e2.seq <= e1.seq) throw new Error("seq should increment");
});

assert("EVENT_PRIORITIES has defined levels", () => {
  if (!envMod.EVENT_PRIORITIES) throw new Error("missing");
  if (!envMod.EVENT_PRIORITIES.critical) throw new Error("no critical");
  if (!envMod.EVENT_PRIORITIES.normal) throw new Error("no normal");
  if (!envMod.EVENT_PRIORITIES.low) throw new Error("no low");
});

assert("coalesceEvents batches events within window", () => {
  if (typeof envMod.coalesceEvents !== "function") throw new Error("missing");
  const events = [
    envMod.createEventEnvelope({ type: "budget.updated", streamKey: "budget", payload: { v: 1 } }),
    envMod.createEventEnvelope({ type: "budget.updated", streamKey: "budget", payload: { v: 2 } }),
    envMod.createEventEnvelope({ type: "budget.updated", streamKey: "budget", payload: { v: 3 } }),
    envMod.createEventEnvelope({ type: "audit.new", streamKey: "audit", payload: { id: "x" } }),
  ];
  const coalesced = envMod.coalesceEvents(events);
  // Budget events should be coalesced, audit should remain
  if (coalesced.length >= events.length) throw new Error("should coalesce same-type events");
  // At least the audit event + one budget event
  if (coalesced.length < 2) throw new Error("should keep different types");
});

assert("serializeForSSE formats event for SSE transport", () => {
  if (typeof envMod.serializeForSSE !== "function") throw new Error("missing");
  const env = envMod.createEventEnvelope({
    type: "task.completed",
    streamKey: "tasks",
    payload: { taskId: "t1" },
  });
  const sse = envMod.serializeForSSE(env);
  if (!sse.includes("event:")) throw new Error("missing event field");
  if (!sse.includes("data:")) throw new Error("missing data field");
  if (!sse.includes("id:")) throw new Error("missing id field");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
