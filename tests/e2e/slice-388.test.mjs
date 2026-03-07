/**
 * Slice 388 — CLI Updates (V2 subcommands)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 388 — CLI Updates (V2 subcommands)\x1b[0m\n");

function makeRoot() {
  const root = join(tmpdir(), `ogu-388-${randomUUID().slice(0,8)}`);
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

const root = makeRoot();

assert("agents help shows V2 commands", () => {
  const out = runCli(root, ["agents", "help"]);
  if (!out.includes("V2 Commands")) throw new Error("missing V2 section");
  if (!out.includes("roles")) throw new Error("missing roles");
  if (!out.includes("generate-v2")) throw new Error("missing generate-v2");
  if (!out.includes("populate-v2")) throw new Error("missing populate-v2");
});

assert("agents roles lists all 64 roles", () => {
  const out = runCli(root, ["agents", "roles"]);
  if (!out.includes("64")) throw new Error("should mention 64 roles");
  if (!out.includes("PRODUCT") || !out.includes("ENGINEERING")) throw new Error("missing categories");
});

assert("agents roles --category=quality filters", () => {
  const out = runCli(root, ["agents", "roles", "--category=quality"]);
  if (!out.includes("quality")) throw new Error("missing quality category");
  if (!out.includes("qa-engineer")) throw new Error("missing qa-engineer");
});

assert("agents roles --category=nonexistent shows message", () => {
  const out = runCli(root, ["agents", "roles", "--category=nonexistent"]);
  if (!out.toLowerCase().includes("no roles")) throw new Error("should show no roles message");
});

assert("agents generate-v2 creates V2 agent", () => {
  const root2 = makeRoot();
  const out = runCli(root2, ["agents", "generate-v2", "qa-engineer", "react", "2"]);
  if (!out.includes("V2 agent")) throw new Error("missing V2 indicator");
  if (!out.includes("agent_")) throw new Error("missing agent_id");
  // Check agent file exists and is V2
  const idx = JSON.parse(readFileSync(join(root2, ".ogu/marketplace/index.json"), "utf-8"));
  if (idx.agents.length !== 1) throw new Error("should have 1 agent");
  const agentFile = join(root2, `.ogu/marketplace/agents/${idx.agents[0].agent_id}.json`);
  const agent = JSON.parse(readFileSync(agentFile, "utf-8"));
  if (agent.profile_version !== 2) throw new Error(`not V2: ${agent.profile_version}`);
  rmSync(root2, { recursive: true, force: true });
});

assert("agents generate-v2 with none specialty", () => {
  const root2 = makeRoot();
  const out = runCli(root2, ["agents", "generate-v2", "product-manager", "none", "1"]);
  if (!out.includes("V2 agent")) throw new Error("missing V2 indicator");
  rmSync(root2, { recursive: true, force: true });
});

assert("agents populate-v2 creates multiple V2 agents", () => {
  const root2 = makeRoot();
  const out = runCli(root2, ["agents", "populate-v2", "--count=5"]);
  if (!out.includes("5 V2 agents")) throw new Error(`unexpected: ${out}`);
  const idx = JSON.parse(readFileSync(join(root2, ".ogu/marketplace/index.json"), "utf-8"));
  if (idx.agents.length !== 5) throw new Error(`got ${idx.agents.length}`);
  rmSync(root2, { recursive: true, force: true });
});

assert("agents populate-v2 --legacy forces V1 generation", () => {
  const root2 = makeRoot();
  const out = runCli(root2, ["agents", "populate-v2", "--count=3", "--legacy"]);
  if (!out.includes("V1 agents")) throw new Error(`unexpected: ${out}`);
  rmSync(root2, { recursive: true, force: true });
});

assert("agents playbook:list shows available playbooks", () => {
  const out = runCli(root, ["agents", "playbook:list"]);
  if (!out.includes("Available Playbooks")) throw new Error("missing header");
  if (!out.includes("qa-engineer")) throw new Error("missing qa-engineer");
});

assert("agents playbook:show displays playbook", () => {
  const out = runCli(root, ["agents", "playbook:show", "qa-engineer"]);
  if (!out.includes("Playbook:")) throw new Error("missing header");
  if (!out.includes("quality")) throw new Error("missing category");
  if (!out.includes("Skills:")) throw new Error("missing skills");
});

assert("agents playbook:show exits 1 for unknown role", () => {
  let threw = false;
  try { runCli(root, ["agents", "playbook:show", "nonexistent-role"]); }
  catch { threw = true; }
  if (!threw) throw new Error("should exit 1");
});

assert("V1 list still works after V2 changes", () => {
  const root2 = makeRoot();
  runCli(root2, ["agents", "populate", "--count=3"]);
  const out = runCli(root2, ["agents", "list"]);
  if (!out.includes("agent_")) throw new Error("V1 list broken");
  rmSync(root2, { recursive: true, force: true });
});

assert("V1 generate still works after V2 changes", () => {
  const root2 = makeRoot();
  const out = runCli(root2, ["agents", "generate", "Engineer", "backend", "2"]);
  if (!out.includes("Generated agent:")) throw new Error("V1 generate broken");
  rmSync(root2, { recursive: true, force: true });
});

assert("V1 show still works after V2 changes", () => {
  const root2 = makeRoot();
  runCli(root2, ["agents", "populate", "--count=1"]);
  const idx = JSON.parse(readFileSync(join(root2, ".ogu/marketplace/index.json"), "utf-8"));
  const out = runCli(root2, ["agents", "show", idx.agents[0].agent_id]);
  if (!out.includes(idx.agents[0].agent_id)) throw new Error("V1 show broken");
  rmSync(root2, { recursive: true, force: true });
});

assert("unknown subcommand exits 1", () => {
  let threw = false;
  try { runCli(root, ["agents", "nonexistent-sub"]); }
  catch { threw = true; }
  if (!threw) throw new Error("should exit 1");
});

rmSync(root, { recursive: true, force: true });

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
