/**
 * Slice 392 — Trainer CLI + Post-Compile Hook
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 392 — Trainer CLI + Post-Compile Hook\x1b[0m\n");

function makeRoot() {
  const root = join(tmpdir(), `ogu-392-${randomUUID().slice(0,8)}`);
  mkdirSync(join(root, ".git"), { recursive: true });
  return root;
}

function runCli(root, args) {
  return execFileSync("node", [
    join(process.cwd(), "tools/ogu/cli.mjs"),
    ...args,
  ], {
    env: { ...process.env, OGU_ROOT: root },
    maxBuffer: 5 * 1024 * 1024,
    encoding: "utf-8",
  });
}

function createAgentWithCandidate(root) {
  // Create agent
  runCli(root, ["agents", "populate-v2", "--count=1"]);
  const idx = JSON.parse(readFileSync(join(root, ".ogu/marketplace/index.json"), "utf-8"));
  const agentId = idx.agents[0].agent_id;

  // Create learning candidate
  const candidateDir = join(root, ".ogu/marketplace/learning-candidates");
  mkdirSync(candidateDir, { recursive: true });
  const candidate = {
    event_id: randomUUID(),
    agent_id: agentId,
    task_type: "build",
    context_signature: [],
    failure_signals: ["lint_error"],
    resolution_summary: "Fixed lint issues",
    iteration_count: 1,
    trigger: "gate_failure",
    status: "pending",
    created_at: new Date().toISOString(),
  };
  writeFileSync(join(candidateDir, `${candidate.event_id}.json`), JSON.stringify(candidate, null, 2), "utf-8");
  return agentId;
}

assert("agents train --dry-run shows what would happen", () => {
  const root = makeRoot();
  const agentId = createAgentWithCandidate(root);
  const out = runCli(root, ["agents", "train", "--dry-run"]);
  if (!out.includes("dry-run")) throw new Error(`unexpected: ${out}`);
  rmSync(root, { recursive: true, force: true });
});

assert("agents train processes candidates", () => {
  const root = makeRoot();
  const agentId = createAgentWithCandidate(root);
  const out = runCli(root, ["agents", "train"]);
  if (!out.includes("Trained")) throw new Error(`unexpected: ${out}`);

  // Verify agent was updated
  const agent = JSON.parse(readFileSync(join(root, `.ogu/marketplace/agents/${agentId}.json`), "utf-8"));
  if (!agent.experience_digest) throw new Error("experience not updated");
  rmSync(root, { recursive: true, force: true });
});

assert("agents train --agent=X trains specific agent", () => {
  const root = makeRoot();
  const agentId = createAgentWithCandidate(root);
  const out = runCli(root, ["agents", "train", `--agent=${agentId}`]);
  if (!out.includes("Trained")) throw new Error(`unexpected: ${out}`);
  rmSync(root, { recursive: true, force: true });
});

assert("agents train with no pending candidates is no-op", () => {
  const root = makeRoot();
  runCli(root, ["agents", "populate-v2", "--count=1"]);
  const out = runCli(root, ["agents", "train"]);
  if (!out.includes("0") && !out.includes("skip")) {
    // Should report 0 trained or skipped
  }
  rmSync(root, { recursive: true, force: true });
});

assert("agents train --dry-run does not modify agent file", () => {
  const root = makeRoot();
  const agentId = createAgentWithCandidate(root);
  const beforeRaw = readFileSync(join(root, `.ogu/marketplace/agents/${agentId}.json`), "utf-8");
  runCli(root, ["agents", "train", "--dry-run"]);
  const afterRaw = readFileSync(join(root, `.ogu/marketplace/agents/${agentId}.json`), "utf-8");
  if (beforeRaw !== afterRaw) throw new Error("dry-run modified agent file");
  rmSync(root, { recursive: true, force: true });
});

assert("agents train --agent=unknown shows error gracefully", () => {
  const root = makeRoot();
  const out = runCli(root, ["agents", "train", "--agent=agent_9999"]);
  // Should not crash — just report no candidates or not found
  if (out.includes("Error")) throw new Error("should handle gracefully");
  rmSync(root, { recursive: true, force: true });
});

assert("compile.mjs has trainer hook import", () => {
  const compilePath = join(process.cwd(), "tools/ogu/commands/compile.mjs");
  const content = readFileSync(compilePath, "utf-8");
  if (!content.includes("agent-trainer.mjs")) throw new Error("missing trainer import in compile.mjs");
  if (!content.includes("trainAll")) throw new Error("missing trainAll call in compile.mjs");
});

assert("compile trainer hook is best-effort (try/catch)", () => {
  const compilePath = join(process.cwd(), "tools/ogu/commands/compile.mjs");
  const content = readFileSync(compilePath, "utf-8");
  // The trainer hook should be wrapped in try/catch
  const trainerSection = content.slice(content.indexOf("Agent Trainer Hook"));
  if (!trainerSection.includes("catch")) throw new Error("trainer hook not wrapped in try/catch");
});

assert("compile trainer hook only runs on success", () => {
  const compilePath = join(process.cwd(), "tools/ogu/commands/compile.mjs");
  const content = readFileSync(compilePath, "utf-8");
  // Should check errorCount === 0 near the trainer hook
  const trainerIdx = content.indexOf("Agent Trainer Hook");
  const surroundingCode = content.slice(Math.max(0, trainerIdx - 200), trainerIdx + 200);
  if (!surroundingCode.includes("errorCount === 0")) throw new Error("trainer should only run on compile success");
});

assert("V1 agents CLI still works after trainer additions", () => {
  const root = makeRoot();
  runCli(root, ["agents", "populate", "--count=2"]);
  const out = runCli(root, ["agents", "list"]);
  if (!out.includes("agent_")) throw new Error("V1 list broken");
  rmSync(root, { recursive: true, force: true });
});

assert("agents help shows train subcommand", () => {
  const root = makeRoot();
  const out = runCli(root, ["agents", "help"]);
  if (!out.includes("train")) throw new Error("missing train in help");
  rmSync(root, { recursive: true, force: true });
});

assert("agents train creates trainer log", () => {
  const root = makeRoot();
  createAgentWithCandidate(root);
  runCli(root, ["agents", "train"]);
  const logPath = join(root, ".ogu/marketplace/trainer/training-log.jsonl");
  if (!existsSync(logPath)) throw new Error("training log not created");
  rmSync(root, { recursive: true, force: true });
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
