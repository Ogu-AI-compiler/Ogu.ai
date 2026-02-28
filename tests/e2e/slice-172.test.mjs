/**
 * Slice 172 — Stream Processor + Windowed Aggregator
 *
 * Stream Processor: process streams with transforms and buffering.
 * Windowed Aggregator: time/count-window aggregations over streams.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 172 — Stream Processor + Windowed Aggregator\x1b[0m\n");

// ── Part 1: Stream Processor ──────────────────────────────

console.log("\x1b[36m  Part 1: Stream Processor\x1b[0m");

const spLib = join(process.cwd(), "tools/ogu/commands/lib/stream-processor.mjs");
assert("stream-processor.mjs exists", () => {
  if (!existsSync(spLib)) throw new Error("file missing");
});

const spMod = await import(spLib);

assert("createStreamProcessor returns processor", () => {
  if (typeof spMod.createStreamProcessor !== "function") throw new Error("missing");
  const sp = spMod.createStreamProcessor();
  if (typeof sp.addTransform !== "function") throw new Error("missing addTransform");
  if (typeof sp.push !== "function") throw new Error("missing push");
  if (typeof sp.getOutput !== "function") throw new Error("missing getOutput");
});

assert("push processes items through transforms", () => {
  const sp = spMod.createStreamProcessor();
  sp.addTransform((item) => item * 2);
  sp.push(5);
  sp.push(10);
  const out = sp.getOutput();
  if (out.length !== 2) throw new Error(`expected 2, got ${out.length}`);
  if (out[0] !== 10) throw new Error(`expected 10, got ${out[0]}`);
  if (out[1] !== 20) throw new Error(`expected 20, got ${out[1]}`);
});

assert("multiple transforms chain", () => {
  const sp = spMod.createStreamProcessor();
  sp.addTransform((x) => x + 1);
  sp.addTransform((x) => x * 10);
  sp.push(3);
  const out = sp.getOutput();
  if (out[0] !== 40) throw new Error(`expected 40, got ${out[0]}`);
});

assert("filter transform removes items", () => {
  const sp = spMod.createStreamProcessor();
  sp.addTransform((x) => (x > 5 ? x : null));
  sp.push(3);
  sp.push(8);
  sp.push(1);
  const out = sp.getOutput();
  if (out.length !== 1) throw new Error(`expected 1, got ${out.length}`);
});

assert("getStats tracks processed count", () => {
  const sp = spMod.createStreamProcessor();
  sp.push(1);
  sp.push(2);
  const stats = sp.getStats();
  if (stats.processed !== 2) throw new Error(`expected 2, got ${stats.processed}`);
});

// ── Part 2: Windowed Aggregator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Windowed Aggregator\x1b[0m");

const waLib = join(process.cwd(), "tools/ogu/commands/lib/windowed-aggregator.mjs");
assert("windowed-aggregator.mjs exists", () => {
  if (!existsSync(waLib)) throw new Error("file missing");
});

const waMod = await import(waLib);

assert("createWindowedAggregator returns aggregator", () => {
  if (typeof waMod.createWindowedAggregator !== "function") throw new Error("missing");
  const wa = waMod.createWindowedAggregator({ windowSize: 3 });
  if (typeof wa.add !== "function") throw new Error("missing add");
  if (typeof wa.aggregate !== "function") throw new Error("missing aggregate");
});

assert("count window collects N items", () => {
  const wa = waMod.createWindowedAggregator({ windowSize: 3 });
  wa.add(10);
  wa.add(20);
  wa.add(30);
  const result = wa.aggregate("sum");
  if (result !== 60) throw new Error(`expected 60, got ${result}`);
});

assert("window slides — old items drop off", () => {
  const wa = waMod.createWindowedAggregator({ windowSize: 2 });
  wa.add(10);
  wa.add(20);
  wa.add(30); // drops 10
  const result = wa.aggregate("sum");
  if (result !== 50) throw new Error(`expected 50, got ${result}`);
});

assert("aggregate avg", () => {
  const wa = waMod.createWindowedAggregator({ windowSize: 4 });
  wa.add(10);
  wa.add(20);
  wa.add(30);
  wa.add(40);
  const result = wa.aggregate("avg");
  if (result !== 25) throw new Error(`expected 25, got ${result}`);
});

assert("aggregate count", () => {
  const wa = waMod.createWindowedAggregator({ windowSize: 10 });
  wa.add(1);
  wa.add(2);
  wa.add(3);
  const result = wa.aggregate("count");
  if (result !== 3) throw new Error(`expected 3, got ${result}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
