/**
 * Slice 376 — agents.mjs CLI
 * Tests: agents list exits 0, agents generate creates file,
 *        agents populate --count=5 creates 5 agents, agents show prints profile.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 376 — agents CLI\x1b[0m\n");

function makeRoot() {
  const root = join(tmpdir(), `ogu-e2e-376-${randomUUID().slice(0,8)}`);
  mkdirSync(join(root, ".git"), { recursive: true }); // fake git root
  return root;
}

function runCli(root, args) {
  return execFileSync("node", [
    join(process.cwd(), "tools/ogu/cli.mjs"),
    ...args,
  ], {
    env:       { ...process.env, OGU_ROOT: root },
    maxBuffer: 5 * 1024 * 1024,
    encoding:  "utf-8",
  });
}

const root = makeRoot();

assert("agents list exits 0 when no agents exist", () => {
  const out = runCli(root, ["agents", "list"]);
  if (!out.toLowerCase().includes("no agents") && !out.includes("Marketplace")) {
    // Either message is fine
    // Actually just checking exit code — if it throws, that's the test failure
  }
});

assert("agents generate creates agent file", () => {
  const out = runCli(root, ["agents", "generate", "Engineer", "backend", "2"]);
  if (!out.includes("Generated agent:")) throw new Error(`unexpected output: ${out}`);
  // File should exist
  const agents = join(root, ".ogu/marketplace/agents");
  if (!existsSync(agents)) throw new Error("agents dir not created");
});

assert("agents populate --count=5 creates 5 agents", () => {
  const root2 = makeRoot();
  const out = runCli(root2, ["agents", "populate", "--count=5"]);
  if (!out.includes("5 agents")) throw new Error(`unexpected output: ${out}`);
  // Index should have 5 entries
  const indexPath = join(root2, ".ogu/marketplace/index.json");
  const idx = JSON.parse(readFileSync(indexPath, "utf-8"));
  if (idx.agents.length !== 5) throw new Error(`expected 5, got ${idx.agents.length}`);
  rmSync(root2, { recursive: true, force: true });
});

assert("agents list shows agents after populate", () => {
  const out = runCli(root, ["agents", "list"]);
  // Should show agent cards
  if (!out.includes("agent_")) throw new Error(`no agent ids in output: ${out.slice(0, 200)}`);
});

assert("agents show prints profile for existing agent", () => {
  const root3 = makeRoot();
  // Generate one agent first
  const genOut = runCli(root3, ["agents", "generate", "QA", "frontend", "1"]);
  const match = genOut.match(/agent_\d{4}/);
  if (!match) throw new Error(`could not find agent_id in: ${genOut}`);
  const agentId = match[0];

  const showOut = runCli(root3, ["agents", "show", agentId]);
  if (!showOut.includes(agentId)) throw new Error("agent_id not in show output");
  if (!showOut.includes("QA"))    throw new Error("role not in show output");
  rmSync(root3, { recursive: true, force: true });
});

assert("agents show exits 1 for unknown agent", () => {
  let threw = false;
  try { runCli(root, ["agents", "show", "agent_9999"]); }
  catch (e) { threw = true; if (!e.message && e.status === 0) throw new Error("should exit 1"); }
  if (!threw) throw new Error("should exit 1 for unknown agent");
});

assert("agents hire creates allocation", () => {
  const root4 = makeRoot();
  // Generate and hire
  runCli(root4, ["agents", "populate", "--count=1"]);
  const idxPath = join(root4, ".ogu/marketplace/index.json");
  const idx = JSON.parse(readFileSync(idxPath, "utf-8"));
  const agentId = idx.agents[0].agent_id;
  const out = runCli(root4, ["agents", "hire", agentId, "proj-test", "2"]);
  if (!out.includes("Agent hired:")) throw new Error(`unexpected output: ${out}`);
  rmSync(root4, { recursive: true, force: true });
});

rmSync(root, { recursive: true, force: true });

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
