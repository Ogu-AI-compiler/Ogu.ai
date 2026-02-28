/**
 * Slice 170 — Span Collector + Trace Context Propagator
 *
 * Span Collector: collect distributed tracing spans.
 * Trace Context Propagator: propagate trace context across boundaries.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 170 — Span Collector + Trace Context Propagator\x1b[0m\n");

// ── Part 1: Span Collector ──────────────────────────────

console.log("\x1b[36m  Part 1: Span Collector\x1b[0m");

const scLib = join(process.cwd(), "tools/ogu/commands/lib/span-collector.mjs");
assert("span-collector.mjs exists", () => {
  if (!existsSync(scLib)) throw new Error("file missing");
});

const scMod = await import(scLib);

assert("createSpanCollector returns collector", () => {
  if (typeof scMod.createSpanCollector !== "function") throw new Error("missing");
  const sc = scMod.createSpanCollector();
  if (typeof sc.startSpan !== "function") throw new Error("missing startSpan");
  if (typeof sc.endSpan !== "function") throw new Error("missing endSpan");
  if (typeof sc.getSpans !== "function") throw new Error("missing getSpans");
});

assert("startSpan creates span with id", () => {
  const sc = scMod.createSpanCollector();
  const span = sc.startSpan({ name: "build", traceId: "t1" });
  if (!span.spanId) throw new Error("missing spanId");
  if (span.name !== "build") throw new Error("wrong name");
});

assert("endSpan records duration", () => {
  const sc = scMod.createSpanCollector();
  const span = sc.startSpan({ name: "compile", traceId: "t1" });
  sc.endSpan(span.spanId);
  const spans = sc.getSpans();
  const ended = spans.find(s => s.spanId === span.spanId);
  if (!ended.endTime) throw new Error("missing endTime");
  if (typeof ended.durationMs !== "number") throw new Error("missing durationMs");
});

assert("child spans reference parent", () => {
  const sc = scMod.createSpanCollector();
  const parent = sc.startSpan({ name: "pipeline", traceId: "t1" });
  const child = sc.startSpan({ name: "step1", traceId: "t1", parentSpanId: parent.spanId });
  if (child.parentSpanId !== parent.spanId) throw new Error("should reference parent");
});

assert("getSpans returns all collected", () => {
  const sc = scMod.createSpanCollector();
  sc.startSpan({ name: "a", traceId: "t1" });
  sc.startSpan({ name: "b", traceId: "t1" });
  if (sc.getSpans().length !== 2) throw new Error("expected 2");
});

// ── Part 2: Trace Context Propagator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Trace Context Propagator\x1b[0m");

const tcLib = join(process.cwd(), "tools/ogu/commands/lib/trace-context-propagator.mjs");
assert("trace-context-propagator.mjs exists", () => {
  if (!existsSync(tcLib)) throw new Error("file missing");
});

const tcMod = await import(tcLib);

assert("createTraceContext returns context", () => {
  if (typeof tcMod.createTraceContext !== "function") throw new Error("missing");
  const tc = tcMod.createTraceContext();
  if (typeof tc.inject !== "function") throw new Error("missing inject");
  if (typeof tc.extract !== "function") throw new Error("missing extract");
});

assert("inject adds trace headers", () => {
  const tc = tcMod.createTraceContext();
  tc.setTraceId("trace-123");
  tc.setSpanId("span-456");
  const headers = {};
  tc.inject(headers);
  if (!headers["x-trace-id"]) throw new Error("missing trace id header");
  if (!headers["x-span-id"]) throw new Error("missing span id header");
});

assert("extract reads trace headers", () => {
  const tc = tcMod.createTraceContext();
  tc.extract({ "x-trace-id": "t-abc", "x-span-id": "s-def" });
  if (tc.getTraceId() !== "t-abc") throw new Error("wrong trace id");
  if (tc.getSpanId() !== "s-def") throw new Error("wrong span id");
});

assert("propagate creates child context", () => {
  const tc = tcMod.createTraceContext();
  tc.setTraceId("trace-1");
  tc.setSpanId("span-1");
  const child = tc.propagate();
  if (child.getTraceId() !== "trace-1") throw new Error("should inherit trace id");
  if (child.getParentSpanId() !== "span-1") throw new Error("parent span should be set");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
