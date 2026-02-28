/**
 * Slice 175 — Workspace Isolator + File Sandbox Manager
 *
 * Workspace Isolator: create isolated workspaces with separate contexts.
 * File Sandbox Manager: manage file access restrictions.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 175 — Workspace Isolator + File Sandbox Manager\x1b[0m\n");

// ── Part 1: Workspace Isolator ──────────────────────────────

console.log("\x1b[36m  Part 1: Workspace Isolator\x1b[0m");

const wiLib = join(process.cwd(), "tools/ogu/commands/lib/workspace-isolator.mjs");
assert("workspace-isolator.mjs exists", () => {
  if (!existsSync(wiLib)) throw new Error("file missing");
});

const wiMod = await import(wiLib);

assert("createWorkspaceIsolator returns isolator", () => {
  if (typeof wiMod.createWorkspaceIsolator !== "function") throw new Error("missing");
  const iso = wiMod.createWorkspaceIsolator();
  if (typeof iso.create !== "function") throw new Error("missing create");
  if (typeof iso.destroy !== "function") throw new Error("missing destroy");
  if (typeof iso.getWorkspace !== "function") throw new Error("missing getWorkspace");
});

assert("create returns workspace with id", () => {
  const iso = wiMod.createWorkspaceIsolator();
  const ws = iso.create({ name: "agent-1", basePath: "/tmp/ws" });
  if (!ws.id) throw new Error("missing id");
  if (ws.name !== "agent-1") throw new Error("wrong name");
  if (ws.status !== "active") throw new Error(`expected active, got ${ws.status}`);
});

assert("destroy marks workspace inactive", () => {
  const iso = wiMod.createWorkspaceIsolator();
  const ws = iso.create({ name: "test", basePath: "/tmp/ws" });
  iso.destroy(ws.id);
  const updated = iso.getWorkspace(ws.id);
  if (updated.status !== "destroyed") throw new Error(`expected destroyed, got ${updated.status}`);
});

assert("listWorkspaces returns all", () => {
  const iso = wiMod.createWorkspaceIsolator();
  iso.create({ name: "a", basePath: "/tmp/a" });
  iso.create({ name: "b", basePath: "/tmp/b" });
  const list = iso.listWorkspaces();
  if (list.length !== 2) throw new Error(`expected 2, got ${list.length}`);
});

assert("workspaces are isolated by id", () => {
  const iso = wiMod.createWorkspaceIsolator();
  const ws1 = iso.create({ name: "a", basePath: "/tmp/a" });
  const ws2 = iso.create({ name: "b", basePath: "/tmp/b" });
  if (ws1.id === ws2.id) throw new Error("should have unique ids");
});

// ── Part 2: File Sandbox Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: File Sandbox Manager\x1b[0m");

const fsmLib = join(process.cwd(), "tools/ogu/commands/lib/file-sandbox-manager.mjs");
assert("file-sandbox-manager.mjs exists", () => {
  if (!existsSync(fsmLib)) throw new Error("file missing");
});

const fsmMod = await import(fsmLib);

assert("createFileSandbox returns sandbox", () => {
  if (typeof fsmMod.createFileSandbox !== "function") throw new Error("missing");
  const sb = fsmMod.createFileSandbox({ root: "/app" });
  if (typeof sb.isAllowed !== "function") throw new Error("missing isAllowed");
  if (typeof sb.addRule !== "function") throw new Error("missing addRule");
});

assert("allows paths within root", () => {
  const sb = fsmMod.createFileSandbox({ root: "/app" });
  if (!sb.isAllowed("/app/src/index.js")) throw new Error("should allow within root");
});

assert("blocks paths outside root", () => {
  const sb = fsmMod.createFileSandbox({ root: "/app" });
  if (sb.isAllowed("/etc/passwd")) throw new Error("should block outside root");
});

assert("blocks path traversal", () => {
  const sb = fsmMod.createFileSandbox({ root: "/app" });
  if (sb.isAllowed("/app/../etc/passwd")) throw new Error("should block traversal");
});

assert("custom deny rules block specific patterns", () => {
  const sb = fsmMod.createFileSandbox({ root: "/app" });
  sb.addRule({ type: "deny", pattern: "*.env" });
  if (sb.isAllowed("/app/.env")) throw new Error("should block .env");
  if (!sb.isAllowed("/app/src/main.js")) throw new Error("should allow .js");
});

assert("getStats tracks checks", () => {
  const sb = fsmMod.createFileSandbox({ root: "/app" });
  sb.isAllowed("/app/file.txt");
  sb.isAllowed("/etc/secret");
  const stats = sb.getStats();
  if (stats.totalChecks !== 2) throw new Error(`expected 2, got ${stats.totalChecks}`);
  if (stats.blocked !== 1) throw new Error(`expected 1 blocked, got ${stats.blocked}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
