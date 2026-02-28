/**
 * Slice 97 — Conversation Context + Session Manager
 *
 * Conversation context: maintain conversation state across turns.
 * Session manager: manage agent sessions with timeout.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 97 — Conversation Context + Session Manager\x1b[0m\n");

// ── Part 1: Conversation Context ──────────────────────────────

console.log("\x1b[36m  Part 1: Conversation Context\x1b[0m");

const ccLib = join(process.cwd(), "tools/ogu/commands/lib/conversation-context.mjs");
assert("conversation-context.mjs exists", () => {
  if (!existsSync(ccLib)) throw new Error("file missing");
});

const ccMod = await import(ccLib);

assert("createConversationContext returns context", () => {
  if (typeof ccMod.createConversationContext !== "function") throw new Error("missing");
  const ctx = ccMod.createConversationContext();
  if (typeof ctx.addMessage !== "function") throw new Error("missing addMessage");
  if (typeof ctx.getHistory !== "function") throw new Error("missing getHistory");
  if (typeof ctx.summarize !== "function") throw new Error("missing summarize");
});

assert("addMessage appends to history", () => {
  const ctx = ccMod.createConversationContext();
  ctx.addMessage({ role: "user", content: "hello" });
  ctx.addMessage({ role: "assistant", content: "hi" });
  const history = ctx.getHistory();
  if (history.length !== 2) throw new Error(`expected 2, got ${history.length}`);
});

assert("setVariable and getVariable for state", () => {
  const ctx = ccMod.createConversationContext();
  ctx.setVariable("task", "auth");
  if (ctx.getVariable("task") !== "auth") throw new Error("wrong variable");
  if (ctx.getVariable("nope") !== undefined) throw new Error("undefined for missing");
});

assert("summarize returns truncated history", () => {
  const ctx = ccMod.createConversationContext({ maxMessages: 3 });
  for (let i = 0; i < 10; i++) ctx.addMessage({ role: "user", content: `msg ${i}` });
  const summary = ctx.summarize();
  if (summary.messages.length > 3) throw new Error("should truncate to maxMessages");
});

assert("clear resets context", () => {
  const ctx = ccMod.createConversationContext();
  ctx.addMessage({ role: "user", content: "test" });
  ctx.setVariable("x", 1);
  ctx.clear();
  if (ctx.getHistory().length !== 0) throw new Error("should be empty after clear");
});

// ── Part 2: Session Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Session Manager\x1b[0m");

const smLib = join(process.cwd(), "tools/ogu/commands/lib/session-manager.mjs");
assert("session-manager.mjs exists", () => {
  if (!existsSync(smLib)) throw new Error("file missing");
});

const smMod = await import(smLib);

assert("createSessionManager returns manager", () => {
  if (typeof smMod.createSessionManager !== "function") throw new Error("missing");
  const mgr = smMod.createSessionManager();
  if (typeof mgr.create !== "function") throw new Error("missing create");
  if (typeof mgr.get !== "function") throw new Error("missing get");
  if (typeof mgr.destroy !== "function") throw new Error("missing destroy");
});

assert("create and get session", () => {
  const mgr = smMod.createSessionManager();
  const id = mgr.create({ agentId: "a1", feature: "auth" });
  const session = mgr.get(id);
  if (!session) throw new Error("should get session");
  if (session.agentId !== "a1") throw new Error("wrong agentId");
});

assert("destroy removes session", () => {
  const mgr = smMod.createSessionManager();
  const id = mgr.create({ agentId: "a1" });
  mgr.destroy(id);
  if (mgr.get(id) !== null) throw new Error("should be null after destroy");
});

assert("listActive returns only active sessions", () => {
  const mgr = smMod.createSessionManager();
  mgr.create({ agentId: "a1" });
  mgr.create({ agentId: "a2" });
  const id3 = mgr.create({ agentId: "a3" });
  mgr.destroy(id3);
  const active = mgr.listActive();
  if (active.length !== 2) throw new Error(`expected 2, got ${active.length}`);
});

assert("touch updates session timestamp", () => {
  const mgr = smMod.createSessionManager();
  const id = mgr.create({ agentId: "a1" });
  const before = mgr.get(id).lastActivity;
  mgr.touch(id);
  const after = mgr.get(id).lastActivity;
  if (after < before) throw new Error("should update lastActivity");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
