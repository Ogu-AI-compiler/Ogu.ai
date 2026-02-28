/**
 * Slice 39 — Service Registry + Task Checkpoint (Topology 1 + Topology 5)
 *
 * Service Registry: formal service map for Kadima ecosystem.
 * Task Checkpoint: checkpoint/resume for individual tasks.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice39-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/checkpoints"), { recursive: true });
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

console.log("\n\x1b[1mSlice 39 — Service Registry + Task Checkpoint\x1b[0m\n");
console.log("  Service map, checkpoint/resume for tasks\n");

// ── Part 1: Service Registry ──────────────────────────────

console.log("\x1b[36m  Part 1: Service Registry\x1b[0m");

const svcLib = join(process.cwd(), "tools/ogu/commands/lib/service-registry.mjs");
assert("service-registry.mjs exists", () => {
  if (!existsSync(svcLib)) throw new Error("file missing");
});

const svcMod = await import(svcLib);

assert("registerService adds a service to the registry", () => {
  if (typeof svcMod.registerService !== "function") throw new Error("missing");
  svcMod.registerService({
    root: tmp,
    id: "kadima",
    name: "Kadima Daemon",
    port: 4200,
    protocol: "http",
    healthEndpoint: "/health",
  });
  const services = svcMod.listServices({ root: tmp });
  if (services.length < 1) throw new Error("not registered");
});

assert("registerService supports multiple services", () => {
  svcMod.registerService({
    root: tmp,
    id: "studio",
    name: "Ogu Studio",
    port: 5173,
    protocol: "http",
    healthEndpoint: "/api/health",
  });
  svcMod.registerService({
    root: tmp,
    id: "preview",
    name: "Preview Server",
    port: 3000,
    protocol: "http",
  });
  const services = svcMod.listServices({ root: tmp });
  if (services.length < 3) throw new Error(`expected 3, got ${services.length}`);
});

assert("getService retrieves a specific service", () => {
  if (typeof svcMod.getService !== "function") throw new Error("missing");
  const svc = svcMod.getService({ root: tmp, id: "kadima" });
  if (!svc) throw new Error("not found");
  if (svc.port !== 4200) throw new Error("wrong port");
});

assert("removeService removes a service", () => {
  if (typeof svcMod.removeService !== "function") throw new Error("missing");
  svcMod.removeService({ root: tmp, id: "preview" });
  const services = svcMod.listServices({ root: tmp });
  if (services.some(s => s.id === "preview")) throw new Error("not removed");
});

// ── Part 2: Task Checkpoint ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Task Checkpoint\x1b[0m");

const cpLib = join(process.cwd(), "tools/ogu/commands/lib/task-checkpoint.mjs");
assert("task-checkpoint.mjs exists", () => {
  if (!existsSync(cpLib)) throw new Error("file missing");
});

const cpMod = await import(cpLib);

assert("createCheckpoint saves task progress", () => {
  if (typeof cpMod.createCheckpoint !== "function") throw new Error("missing");
  const cp = cpMod.createCheckpoint({
    root: tmp,
    taskId: "t1",
    featureSlug: "feat-a",
    progress: 0.5,
    state: { filesModified: ["src/a.ts"], linesWritten: 42 },
  });
  if (!cp.id) throw new Error("no id");
  if (cp.progress !== 0.5) throw new Error("wrong progress");
});

assert("loadCheckpoint retrieves saved checkpoint", () => {
  if (typeof cpMod.loadCheckpoint !== "function") throw new Error("missing");
  const cp = cpMod.loadCheckpoint({ root: tmp, taskId: "t1" });
  if (!cp) throw new Error("not found");
  if (cp.progress !== 0.5) throw new Error("wrong progress");
  if (cp.state.linesWritten !== 42) throw new Error("wrong state");
});

assert("updateCheckpoint updates progress", () => {
  if (typeof cpMod.updateCheckpoint !== "function") throw new Error("missing");
  cpMod.updateCheckpoint({ root: tmp, taskId: "t1", progress: 0.8, state: { filesModified: ["src/a.ts", "src/b.ts"] } });
  const cp = cpMod.loadCheckpoint({ root: tmp, taskId: "t1" });
  if (cp.progress !== 0.8) throw new Error("progress not updated");
  if (cp.state.filesModified.length !== 2) throw new Error("state not updated");
});

assert("listCheckpoints returns all checkpoints", () => {
  if (typeof cpMod.listCheckpoints !== "function") throw new Error("missing");
  cpMod.createCheckpoint({ root: tmp, taskId: "t2", featureSlug: "feat-b", progress: 0.1, state: {} });
  const cps = cpMod.listCheckpoints({ root: tmp });
  if (cps.length < 2) throw new Error(`expected at least 2, got ${cps.length}`);
});

assert("clearCheckpoint removes a checkpoint", () => {
  if (typeof cpMod.clearCheckpoint !== "function") throw new Error("missing");
  cpMod.clearCheckpoint({ root: tmp, taskId: "t2" });
  const cp = cpMod.loadCheckpoint({ root: tmp, taskId: "t2" });
  if (cp) throw new Error("should be cleared");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
