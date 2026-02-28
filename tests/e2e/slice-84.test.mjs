/**
 * Slice 84 — Daemon Client + Runner Remote
 *
 * Daemon client: HTTP client for communicating with Kadima daemon.
 * Runner remote: remote runner via HTTP protocol.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 84 — Daemon Client + Runner Remote\x1b[0m\n");

// ── Part 1: Daemon Client ──────────────────────────────

console.log("\x1b[36m  Part 1: Daemon Client\x1b[0m");

const dcLib = join(process.cwd(), "tools/ogu/commands/lib/daemon-client.mjs");
assert("daemon-client.mjs exists", () => {
  if (!existsSync(dcLib)) throw new Error("file missing");
});

const dcMod = await import(dcLib);

assert("createDaemonClient returns client", () => {
  if (typeof dcMod.createDaemonClient !== "function") throw new Error("missing");
  const client = dcMod.createDaemonClient({ host: "localhost", port: 9000 });
  if (typeof client.send !== "function") throw new Error("missing send");
  if (typeof client.getStatus !== "function") throw new Error("missing getStatus");
  if (typeof client.isConnected !== "function") throw new Error("missing isConnected");
});

assert("buildRequest creates proper request envelope", () => {
  if (typeof dcMod.buildRequest !== "function") throw new Error("missing");
  const req = dcMod.buildRequest("compile", { slug: "auth" });
  if (req.command !== "compile") throw new Error("wrong command");
  if (!req.payload) throw new Error("missing payload");
  if (!req.requestId) throw new Error("missing requestId");
  if (!req.timestamp) throw new Error("missing timestamp");
});

assert("parseResponse extracts result from envelope", () => {
  if (typeof dcMod.parseResponse !== "function") throw new Error("missing");
  const res = dcMod.parseResponse({
    requestId: "r1",
    status: "success",
    result: { gates: 14 },
  });
  if (res.status !== "success") throw new Error("wrong status");
  if (res.result.gates !== 14) throw new Error("wrong result");
});

assert("client defaults to offline mode", () => {
  const client = dcMod.createDaemonClient({ host: "localhost", port: 9000 });
  if (client.isConnected()) throw new Error("should not be connected without daemon");
  const status = client.getStatus();
  if (status.mode !== "offline") throw new Error(`expected offline, got ${status.mode}`);
});

// ── Part 2: Runner Remote ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Runner Remote\x1b[0m");

const rrLib = join(process.cwd(), "tools/ogu/commands/lib/runner-remote.mjs");
assert("runner-remote.mjs exists", () => {
  if (!existsSync(rrLib)) throw new Error("file missing");
});

const rrMod = await import(rrLib);

assert("createRemoteRunner returns runner with correct type", () => {
  if (typeof rrMod.createRemoteRunner !== "function") throw new Error("missing");
  const runner = rrMod.createRemoteRunner({ host: "runner1.local", port: 8080 });
  if (runner.type !== "remote") throw new Error("type should be remote");
  if (typeof runner.execute !== "function") throw new Error("missing execute");
  if (typeof runner.getStatus !== "function") throw new Error("missing getStatus");
});

assert("getStatus returns connection info", () => {
  const runner = rrMod.createRemoteRunner({ host: "runner1.local", port: 8080 });
  const status = runner.getStatus();
  if (status.host !== "runner1.local") throw new Error("wrong host");
  if (status.port !== 8080) throw new Error("wrong port");
  if (status.type !== "remote") throw new Error("wrong type");
});

assert("buildExecutePayload creates remote exec request", () => {
  if (typeof rrMod.buildExecutePayload !== "function") throw new Error("missing");
  const payload = rrMod.buildExecutePayload({
    taskId: "t1",
    command: "build",
    args: ["--verbose"],
  });
  if (payload.taskId !== "t1") throw new Error("wrong taskId");
  if (payload.command !== "build") throw new Error("wrong command");
  if (!payload.args.includes("--verbose")) throw new Error("missing arg");
});

assert("REMOTE_PROTOCOLS exported", () => {
  if (!rrMod.REMOTE_PROTOCOLS) throw new Error("missing");
  if (!Array.isArray(rrMod.REMOTE_PROTOCOLS)) throw new Error("should be array");
  if (!rrMod.REMOTE_PROTOCOLS.includes("http")) throw new Error("missing http");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
