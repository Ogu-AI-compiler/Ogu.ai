/**
 * Slice 47 — Time Travel + GenUI Widget Schema (P27 + P28 prep)
 *
 * Time Travel: snapshot + delta reconstruction for read-only state replay.
 * GenUI Widgets: dynamic widget schema for Studio runtime rendering.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice47-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/snapshots"), { recursive: true });
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

console.log("\n\x1b[1mSlice 47 — Time Travel + GenUI Widget Schema\x1b[0m\n");
console.log("  State replay, dynamic widgets\n");

// ── Part 1: Time Travel ──────────────────────────────

console.log("\x1b[36m  Part 1: Time Travel Engine\x1b[0m");

const ttLib = join(process.cwd(), "tools/ogu/commands/lib/time-travel.mjs");
assert("time-travel.mjs exists", () => {
  if (!existsSync(ttLib)) throw new Error("file missing");
});

const ttMod = await import(ttLib);

assert("saveSnapshot captures state at a point in time", () => {
  if (typeof ttMod.saveSnapshot !== "function") throw new Error("missing");
  const snap = ttMod.saveSnapshot({
    root: tmp,
    label: "after-phase-1",
    state: { phase: "build", features: { auth: "ready" } },
  });
  if (!snap.id) throw new Error("no id");
  if (!snap.timestamp) throw new Error("no timestamp");
  if (snap.label !== "after-phase-1") throw new Error("wrong label");
});

assert("saveSnapshot creates multiple snapshots", () => {
  ttMod.saveSnapshot({
    root: tmp,
    label: "after-phase-2",
    state: { phase: "verify", features: { auth: "compiling" } },
  });
  ttMod.saveSnapshot({
    root: tmp,
    label: "after-phase-3",
    state: { phase: "done", features: { auth: "done" } },
  });
});

assert("listSnapshots returns all snapshots in order", () => {
  if (typeof ttMod.listSnapshots !== "function") throw new Error("missing");
  const snaps = ttMod.listSnapshots({ root: tmp });
  if (snaps.length < 3) throw new Error(`expected at least 3, got ${snaps.length}`);
  // Should be ordered by timestamp
  for (let i = 1; i < snaps.length; i++) {
    if (snaps[i].timestamp < snaps[i - 1].timestamp) throw new Error("not sorted");
  }
});

assert("loadSnapshot retrieves state at a point", () => {
  if (typeof ttMod.loadSnapshot !== "function") throw new Error("missing");
  const snaps = ttMod.listSnapshots({ root: tmp });
  const snap = ttMod.loadSnapshot({ root: tmp, id: snaps[0].id });
  if (!snap) throw new Error("not found");
  if (!snap.state) throw new Error("no state");
  if (snap.state.phase !== "build") throw new Error("wrong state");
});

assert("computeDelta shows changes between snapshots", () => {
  if (typeof ttMod.computeDelta !== "function") throw new Error("missing");
  const snaps = ttMod.listSnapshots({ root: tmp });
  const first = snaps.find(s => s.label === "after-phase-1");
  const last = snaps.find(s => s.label === "after-phase-3");
  if (!first || !last) throw new Error("snapshots missing");
  const delta = ttMod.computeDelta({
    root: tmp,
    fromId: first.id,
    toId: last.id,
  });
  if (!delta) throw new Error("no delta");
  if (!Array.isArray(delta.changes)) throw new Error("no changes array");
  if (delta.changes.length < 1) throw new Error("should have changes");
});

assert("replayTo reconstructs state at a given snapshot", () => {
  if (typeof ttMod.replayTo !== "function") throw new Error("missing");
  const snaps = ttMod.listSnapshots({ root: tmp });
  const phase2 = snaps.find(s => s.label === "after-phase-2");
  if (!phase2) throw new Error("after-phase-2 snapshot not found");
  const state = ttMod.replayTo({ root: tmp, snapshotId: phase2.id });
  if (!state) throw new Error("no state");
  if (state.phase !== "verify") throw new Error("wrong phase at snapshot 2");
});

// ── Part 2: GenUI Widget Schema ──────────────────────────────

console.log("\n\x1b[36m  Part 2: GenUI Widget Schema\x1b[0m");

const widgetLib = join(process.cwd(), "tools/ogu/commands/lib/genui-widgets.mjs");
assert("genui-widgets.mjs exists", () => {
  if (!existsSync(widgetLib)) throw new Error("file missing");
});

const widgetMod = await import(widgetLib);

assert("WIDGET_TYPES has defined types", () => {
  if (!widgetMod.WIDGET_TYPES) throw new Error("missing");
  if (!widgetMod.WIDGET_TYPES.progress) throw new Error("no progress");
  if (!widgetMod.WIDGET_TYPES.table) throw new Error("no table");
  if (!widgetMod.WIDGET_TYPES.chart) throw new Error("no chart");
  if (!widgetMod.WIDGET_TYPES.status) throw new Error("no status");
});

assert("createWidget builds a typed widget descriptor", () => {
  if (typeof widgetMod.createWidget !== "function") throw new Error("missing");
  const widget = widgetMod.createWidget({
    type: "progress",
    title: "Build Progress",
    data: { current: 7, total: 14, label: "Gates passed" },
  });
  if (!widget.id) throw new Error("no id");
  if (widget.type !== "progress") throw new Error("wrong type");
  if (!widget.data) throw new Error("no data");
});

assert("createWidget validates widget type", () => {
  let threw = false;
  try {
    widgetMod.createWidget({ type: "invalid-type", title: "X", data: {} });
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("should reject invalid type");
});

assert("createDashboardLayout arranges widgets in grid", () => {
  if (typeof widgetMod.createDashboardLayout !== "function") throw new Error("missing");
  const layout = widgetMod.createDashboardLayout({
    widgets: [
      widgetMod.createWidget({ type: "progress", title: "Build", data: { current: 5, total: 10 } }),
      widgetMod.createWidget({ type: "status", title: "Health", data: { status: "ok" } }),
      widgetMod.createWidget({ type: "table", title: "Tasks", data: { rows: [] } }),
    ],
    columns: 2,
  });
  if (!Array.isArray(layout.grid)) throw new Error("no grid");
  if (layout.columns !== 2) throw new Error("wrong columns");
});

assert("serializeWidgets produces JSON-safe output", () => {
  if (typeof widgetMod.serializeWidgets !== "function") throw new Error("missing");
  const widgets = [
    widgetMod.createWidget({ type: "chart", title: "Spending", data: { values: [1, 2, 3] } }),
  ];
  const json = widgetMod.serializeWidgets(widgets);
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("should be array");
  if (parsed.length !== 1) throw new Error("wrong count");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
