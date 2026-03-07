/**
 * Slice 84 — Daemon Client
 *
 * Daemon client: HTTP client for communicating with Kadima daemon.

 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 84 — Daemon Client\x1b[0m\n");

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
