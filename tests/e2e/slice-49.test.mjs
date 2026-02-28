/**
 * Slice 49 — Memory CLI + Chatplex Routing + Contract Generator CLI
 *
 * Memory CLI: search and manage semantic memory from CLI.
 * Chatplex: multi-target message routing schema.
 * Contract CLI: generate contracts from CLI.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice49-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/memory"), { recursive: true });
mkdirSync(join(tmp, "docs/vault/02_Contracts"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

const ogu = join(process.cwd(), "tools/ogu/cli.mjs");
function oguSafe(args, cwd) {
  try {
    return execFileSync("node", [ogu, ...args], { cwd: cwd || tmp, encoding: "utf8", timeout: 15000 });
  } catch (e) {
    return e.stdout || e.stderr || e.message;
  }
}

console.log("\n\x1b[1mSlice 49 — Memory CLI + Chatplex + Contract CLI\x1b[0m\n");
console.log("  CLI for semantic memory, multi-target chat, contract generation\n");

// ── Part 1: Memory CLI ──────────────────────────────

console.log("\x1b[36m  Part 1: Memory CLI\x1b[0m");

const memLib = join(process.cwd(), "tools/ogu/commands/lib/semantic-memory.mjs");
const memMod = await import(memLib);

// Seed some memory
memMod.storeMemory({ root: tmp, content: "Use Zod for validation", tags: ["zod", "validation"], source: "feat:auth", category: "pattern" });
memMod.storeMemory({ root: tmp, content: "Prefer httpOnly cookies", tags: ["security", "auth"], source: "feat:auth", category: "decision" });
memMod.storeMemory({ root: tmp, content: "Circuit breakers for API calls", tags: ["resilience"], source: "feat:pay", category: "pattern" });

assert("memory:search finds by query", () => {
  const out = oguSafe(["memory:search", "validation", "--json"], tmp);
  const results = JSON.parse(out);
  if (!Array.isArray(results)) throw new Error("not array");
  if (results.length < 1) throw new Error("no results");
});

assert("memory:search finds by tag", () => {
  const out = oguSafe(["memory:search", "--tag", "security", "--json"], tmp);
  const results = JSON.parse(out);
  if (results.length < 1) throw new Error("no results for security tag");
});

assert("memory:list shows all entries", () => {
  const out = oguSafe(["memory:list", "--json"], tmp);
  const entries = JSON.parse(out);
  if (entries.length < 3) throw new Error(`expected at least 3, got ${entries.length}`);
});

assert("memory:store adds new entry", () => {
  oguSafe(["memory:store", "Always validate inputs at boundaries", "--tag", "security", "--tag", "validation"], tmp);
  const entries = memMod.listMemories({ root: tmp });
  if (entries.length < 4) throw new Error("entry not stored");
});

// ── Part 2: Chatplex Routing ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Chatplex Multi-Target Routing\x1b[0m");

const chatplexLib = join(process.cwd(), "tools/ogu/commands/lib/chatplex.mjs");
assert("chatplex.mjs exists", () => {
  if (!existsSync(chatplexLib)) throw new Error("file missing");
});

const chatMod = await import(chatplexLib);

assert("createChannel defines a chat target", () => {
  if (typeof chatMod.createChannel !== "function") throw new Error("missing");
  const ch = chatMod.createChannel({
    id: "dev",
    name: "Developer Agent",
    roleId: "developer",
    model: "claude-sonnet",
  });
  if (ch.id !== "dev") throw new Error("wrong id");
  if (ch.roleId !== "developer") throw new Error("wrong roleId");
});

assert("routeMessage routes to correct channel", () => {
  if (typeof chatMod.routeMessage !== "function") throw new Error("missing");
  const channels = [
    chatMod.createChannel({ id: "dev", name: "Dev", roleId: "developer" }),
    chatMod.createChannel({ id: "review", name: "Reviewer", roleId: "reviewer" }),
  ];
  const routed = chatMod.routeMessage({
    message: "Please review this PR",
    channels,
    targetId: "review",
  });
  if (routed.channelId !== "review") throw new Error("wrong channel");
  if (!routed.message) throw new Error("no message");
});

assert("broadcastMessage sends to all channels", () => {
  if (typeof chatMod.broadcastMessage !== "function") throw new Error("missing");
  const channels = [
    chatMod.createChannel({ id: "a", name: "A", roleId: "dev" }),
    chatMod.createChannel({ id: "b", name: "B", roleId: "test" }),
  ];
  const msgs = chatMod.broadcastMessage({ message: "All hands standup", channels });
  if (msgs.length !== 2) throw new Error(`expected 2, got ${msgs.length}`);
});

assert("CHANNEL_TYPES has defined types", () => {
  if (!chatMod.CHANNEL_TYPES) throw new Error("missing");
  if (!chatMod.CHANNEL_TYPES.agent) throw new Error("no agent type");
  if (!chatMod.CHANNEL_TYPES.human) throw new Error("no human type");
});

// ── Part 3: Contract Generator CLI ──────────────────────────────

console.log("\n\x1b[36m  Part 3: Contract Generator CLI\x1b[0m");

assert("contract:generate creates a contract file", () => {
  const out = oguSafe(["contract:generate", "TestContract", "--invariant", "Data must be valid"], tmp);
  if (!out) throw new Error("no output");
  const path = join(tmp, "docs/vault/02_Contracts/TestContract.contract.md");
  if (!existsSync(path)) throw new Error("file not created");
});

assert("contract:list shows generated contracts", () => {
  const out = oguSafe(["contract:list", "--json"], tmp);
  const contracts = JSON.parse(out);
  if (!Array.isArray(contracts)) throw new Error("not array");
  if (contracts.length < 1) throw new Error("no contracts");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
