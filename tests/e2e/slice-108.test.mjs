/**
 * Slice 108 — Worktree Creator + Agent Controller
 *
 * Worktree creator: create/remove git worktrees for agent isolation.
 * Agent controller: start/stop/pause/resume agent execution lifecycle.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 108 — Worktree Creator + Agent Controller\x1b[0m\n");

// ── Part 1: Worktree Creator ──────────────────────────────

console.log("\x1b[36m  Part 1: Worktree Creator\x1b[0m");

const wcLib = join(process.cwd(), "tools/ogu/commands/lib/worktree-creator.mjs");
assert("worktree-creator.mjs exists", () => {
  if (!existsSync(wcLib)) throw new Error("file missing");
});

const wcMod = await import(wcLib);

assert("createWorktreeCreator returns creator", () => {
  if (typeof wcMod.createWorktreeCreator !== "function") throw new Error("missing");
  const wc = wcMod.createWorktreeCreator({ repoRoot: "/tmp/test-repo" });
  if (typeof wc.plan !== "function") throw new Error("missing plan");
  if (typeof wc.create !== "function") throw new Error("missing create");
  if (typeof wc.remove !== "function") throw new Error("missing remove");
  if (typeof wc.list !== "function") throw new Error("missing list");
});

assert("plan generates worktree spec", () => {
  const wc = wcMod.createWorktreeCreator({ repoRoot: "/tmp/test-repo" });
  const spec = wc.plan({ agentId: "backend-dev", taskId: "task-42", feature: "auth" });
  if (!spec.branch) throw new Error("missing branch");
  if (!spec.path) throw new Error("missing path");
  if (!spec.branch.includes("backend-dev")) throw new Error("branch should include agent id");
});

assert("create registers worktree (dry-run mode)", async () => {
  const wc = wcMod.createWorktreeCreator({ repoRoot: "/tmp/test-repo", dryRun: true });
  const result = await wc.create({ agentId: "qa", taskId: "task-5", feature: "payments" });
  if (!result.branch) throw new Error("missing branch");
  if (result.dryRun !== true) throw new Error("should be dry run");
});

assert("list returns all registered worktrees", async () => {
  const wc = wcMod.createWorktreeCreator({ repoRoot: "/tmp/test-repo", dryRun: true });
  await wc.create({ agentId: "dev1", taskId: "t1", feature: "f1" });
  await wc.create({ agentId: "dev2", taskId: "t2", feature: "f2" });
  const wts = wc.list();
  if (wts.length !== 2) throw new Error(`expected 2, got ${wts.length}`);
});

assert("remove unregisters worktree", async () => {
  const wc = wcMod.createWorktreeCreator({ repoRoot: "/tmp/test-repo", dryRun: true });
  const result = await wc.create({ agentId: "dev", taskId: "t1", feature: "f1" });
  wc.remove(result.branch);
  const wts = wc.list();
  if (wts.length !== 0) throw new Error(`expected 0, got ${wts.length}`);
});

// ── Part 2: Agent Controller ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Agent Controller\x1b[0m");

const acLib = join(process.cwd(), "tools/ogu/commands/lib/agent-controller.mjs");
assert("agent-controller.mjs exists", () => {
  if (!existsSync(acLib)) throw new Error("file missing");
});

const acMod = await import(acLib);

assert("createAgentController returns controller", () => {
  if (typeof acMod.createAgentController !== "function") throw new Error("missing");
  const ac = acMod.createAgentController();
  if (typeof ac.start !== "function") throw new Error("missing start");
  if (typeof ac.stop !== "function") throw new Error("missing stop");
  if (typeof ac.pause !== "function") throw new Error("missing pause");
  if (typeof ac.resume !== "function") throw new Error("missing resume");
});

assert("start transitions agent to running", () => {
  const ac = acMod.createAgentController();
  ac.register("dev-1", { role: "backend-dev" });
  ac.start("dev-1");
  const status = ac.getStatus("dev-1");
  if (status.state !== "running") throw new Error(`expected running, got ${status.state}`);
});

assert("pause transitions running to paused", () => {
  const ac = acMod.createAgentController();
  ac.register("dev-1", { role: "backend-dev" });
  ac.start("dev-1");
  ac.pause("dev-1");
  const status = ac.getStatus("dev-1");
  if (status.state !== "paused") throw new Error(`expected paused, got ${status.state}`);
});

assert("resume transitions paused to running", () => {
  const ac = acMod.createAgentController();
  ac.register("dev-1", { role: "backend-dev" });
  ac.start("dev-1");
  ac.pause("dev-1");
  ac.resume("dev-1");
  const status = ac.getStatus("dev-1");
  if (status.state !== "running") throw new Error(`expected running, got ${status.state}`);
});

assert("stop transitions to stopped", () => {
  const ac = acMod.createAgentController();
  ac.register("dev-1", { role: "backend-dev" });
  ac.start("dev-1");
  ac.stop("dev-1");
  const status = ac.getStatus("dev-1");
  if (status.state !== "stopped") throw new Error(`expected stopped, got ${status.state}`);
});

assert("AGENT_STATES exported", () => {
  if (!Array.isArray(acMod.AGENT_STATES)) throw new Error("missing");
  const expected = ["idle", "running", "paused", "stopped", "failed"];
  for (const s of expected) {
    if (!acMod.AGENT_STATES.includes(s)) throw new Error(`missing state ${s}`);
  }
});

assert("listAgents returns all registered agents", () => {
  const ac = acMod.createAgentController();
  ac.register("a", { role: "qa" });
  ac.register("b", { role: "dev" });
  const agents = ac.listAgents();
  if (agents.length !== 2) throw new Error(`expected 2, got ${agents.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
