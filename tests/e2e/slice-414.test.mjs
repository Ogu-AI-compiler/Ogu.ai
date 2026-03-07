/**
 * Slice 414 — Marketplace Bridge (Slice 399: skill routing integration)
 * Tests: getProjectAgents, selectAgentForTask, enrichTaskWithAgent,
 *        enrichTaskForProject, buildAgentHeader, buildEnrichedPrompt,
 *        injectSkillsIntoSystemPrompt
 */

import { join } from "node:path";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 414 — Marketplace Bridge (skill routing)\x1b[0m\n");

const bridge = await import(join(process.cwd(), "tools/ogu/commands/lib/marketplace-bridge.mjs"));
const {
  getProjectAgents, selectAgentForTask, enrichTaskWithAgent,
  enrichTaskForProject, buildAgentHeader, buildEnrichedPrompt,
  injectSkillsIntoSystemPrompt,
} = bridge;

function makeTmpRoot() {
  const root = mkdtempSync(join(tmpdir(), "slice414-"));
  mkdirSync(join(root, ".ogu", "marketplace", "agents"), { recursive: true });
  mkdirSync(join(root, ".ogu", "marketplace", "allocations"), { recursive: true });
  writeFileSync(join(root, ".ogu", "marketplace", "allocations", "index.json"), "[]", "utf-8");
  return root;
}

const SAMPLE_AGENT = {
  agent_id: "agent_0001",
  name: "Alex Chen",
  role: "frontend-developer",
  role_display: "Frontend Developer",
  specialty: "react",
  tier: 2,
  dna: { work_style: "deep-work", communication_style: "concise", strength_bias: "creative" },
  skills: ["react", "css-systems", "debugging", "testing-frontend"],
  skill_definitions: [
    { name: "react", description: "React expertise. Use when building React components. Triggers: \"react\", \"component\"." },
    { name: "debugging", description: "Finds bugs. Use when debugging. Triggers: \"debug\", \"fix bug\"." },
    { name: "css-systems", description: "CSS design systems. Use when styling. Triggers: \"css\", \"styling\"." },
  ],
  system_prompt: "## Identity\nYou are Alex Chen.",
  capacity_units: 8,
  stats: { utilization_units: 2 },
};

// ── getProjectAgents ──────────────────────────────────────────────────────────
console.log("\n  getProjectAgents()");

assert("returns empty array when marketplace not found", () => {
  const root = makeTmpRoot();
  const agents = getProjectAgents(root, "project-xyz");
  if (!Array.isArray(agents) || agents.length !== 0) throw new Error("expected empty array");
});

assert("returns empty for null projectId", () => {
  const root = makeTmpRoot();
  const agents = getProjectAgents(root, null);
  if (agents.length !== 0) throw new Error("expected empty");
});

// ── selectAgentForTask ────────────────────────────────────────────────────────
console.log("\n  selectAgentForTask()");

const AGENTS = [SAMPLE_AGENT, {
  ...SAMPLE_AGENT,
  agent_id: "agent_0002",
  role: "backend-developer",
  tier: 3,
  skills: ["api-design", "node", "databases"],
  skill_definitions: [],
}];

assert("returns null for empty agents array", () => {
  if (selectAgentForTask([], { description: "implement feature" }) !== null) {
    throw new Error("expected null");
  }
});
assert("returns first agent when no task provided", () => {
  const agent = selectAgentForTask(AGENTS, null);
  if (!agent) throw new Error("expected agent");
});
assert("selects frontend agent for react task", () => {
  const agent = selectAgentForTask(AGENTS, { description: "build a react component" });
  if (!agent) throw new Error("no agent selected");
  if (!agent.role.includes("frontend")) throw new Error(`wrong role: ${agent.role}`);
});
assert("selects higher-tier agent when roles tie", () => {
  const agents = [
    { ...SAMPLE_AGENT, agent_id: "low", tier: 1, skills: ["api-design"] },
    { ...SAMPLE_AGENT, agent_id: "high", tier: 4, skills: ["api-design"] },
  ];
  const agent = selectAgentForTask(agents, { description: "design api" });
  if (agent.agent_id !== "high") throw new Error(`expected high-tier: got ${agent.agent_id}`);
});

// ── enrichTaskWithAgent ───────────────────────────────────────────────────────
console.log("\n  enrichTaskWithAgent()");

assert("returns task with agentId attached", () => {
  const task = { id: "T1", description: "debug a react component" };
  const enriched = enrichTaskWithAgent(task, SAMPLE_AGENT, { loadBodies: false });
  if (enriched.agentId !== "agent_0001") throw new Error(`agentId: ${enriched.agentId}`);
});
assert("returns agentContext string", () => {
  const enriched = enrichTaskWithAgent(
    { description: "implement the login form" }, SAMPLE_AGENT, { loadBodies: false }
  );
  if (typeof enriched.agentContext !== "string") throw new Error("agentContext not string");
  if (!enriched.agentContext.includes("Alex Chen")) throw new Error("missing agent name");
});
assert("returns skillContext string", () => {
  const enriched = enrichTaskWithAgent(
    { description: "debug a react component" }, SAMPLE_AGENT, { loadBodies: false }
  );
  if (typeof enriched.skillContext !== "string") throw new Error("skillContext not string");
});
assert("returns matchedSkills array", () => {
  const enriched = enrichTaskWithAgent(
    { description: "debug the react component" }, SAMPLE_AGENT, { loadBodies: false }
  );
  if (!Array.isArray(enriched.matchedSkills)) throw new Error("matchedSkills not array");
});
assert("returns enrichedPrompt combining all layers", () => {
  const enriched = enrichTaskWithAgent(
    { description: "debug this bug", prompt: "Fix the login bug" }, SAMPLE_AGENT, { loadBodies: false }
  );
  if (!enriched.enrichedPrompt) throw new Error("enrichedPrompt empty");
});
assert("handles null task gracefully", () => {
  const result = enrichTaskWithAgent(null, SAMPLE_AGENT);
  if (typeof result !== "object") throw new Error("expected object");
});

// ── buildAgentHeader ──────────────────────────────────────────────────────────
console.log("\n  buildAgentHeader()");

assert("includes agent name", () => {
  const h = buildAgentHeader(SAMPLE_AGENT);
  if (!h.includes("Alex Chen")) throw new Error("missing name");
});
assert("includes role and tier", () => {
  const h = buildAgentHeader(SAMPLE_AGENT);
  if (!h.includes("Tier 2")) throw new Error("missing tier");
  if (!h.includes("Frontend Developer")) throw new Error("missing role");
});
assert("includes DNA fields", () => {
  const h = buildAgentHeader(SAMPLE_AGENT);
  if (!h.includes("deep-work")) throw new Error("missing work_style");
});
assert("returns empty string for null agent", () => {
  if (buildAgentHeader(null) !== "") throw new Error("expected empty string");
});

// ── buildEnrichedPrompt ───────────────────────────────────────────────────────
console.log("\n  buildEnrichedPrompt()");

assert("combines all three parts with separators", () => {
  const p = buildEnrichedPrompt("Fix the bug.", "## Agent: Alex", "## Skills: debugging");
  if (!p.includes("Fix the bug.")) throw new Error("missing base prompt");
  if (!p.includes("## Agent: Alex")) throw new Error("missing agent context");
  if (!p.includes("## Skills: debugging")) throw new Error("missing skill context");
  if (!p.includes("---")) throw new Error("missing separator");
});
assert("works with empty components", () => {
  const p = buildEnrichedPrompt("Task only.", "", "");
  if (!p.includes("Task only.")) throw new Error("missing task");
});

// ── injectSkillsIntoSystemPrompt ──────────────────────────────────────────────
console.log("\n  injectSkillsIntoSystemPrompt()");

assert("returns original prompt when no agent", () => {
  const result = injectSkillsIntoSystemPrompt("Base prompt.", null, "debug the error");
  if (result !== "Base prompt.") throw new Error(`got: ${result}`);
});
assert("returns original prompt when no task description", () => {
  const result = injectSkillsIntoSystemPrompt("Base prompt.", SAMPLE_AGENT, "");
  if (result !== "Base prompt.") throw new Error(`got: ${result}`);
});
assert("appends skill context when skills match", () => {
  const result = injectSkillsIntoSystemPrompt(
    "Base prompt.", SAMPLE_AGENT, "debug the react component", { loadBodies: false }
  );
  if (!result.includes("Base prompt.")) throw new Error("missing base");
  if (!result.includes("---")) throw new Error("missing separator");
});
assert("result starts with original system prompt", () => {
  const result = injectSkillsIntoSystemPrompt(
    "## Role\nYou are an engineer.", SAMPLE_AGENT, "fix this bug", { loadBodies: false }
  );
  if (!result.startsWith("## Role")) throw new Error("original prompt not at start");
});

// ── enrichTaskForProject ──────────────────────────────────────────────────────
console.log("\n  enrichTaskForProject()");

assert("returns task unchanged when no projectId", () => {
  const root = makeTmpRoot();
  const task = { id: "T1", description: "implement feature" };
  const result = enrichTaskForProject(root, task);
  if (result.agentId) throw new Error("should not have agentId");
});

assert("returns task unchanged when no agents hired", () => {
  const root = makeTmpRoot();
  const task = { id: "T1", description: "implement feature", projectId: "proj-123" };
  const result = enrichTaskForProject(root, task);
  if (result.agentId) throw new Error("should not have agentId when no agents");
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
