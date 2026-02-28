/**
 * Slice 245 — Pipeline Stage + Hazard Detector
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 245 — Pipeline Stage + Hazard Detector\x1b[0m\n");
console.log("\x1b[36m  Part 1: Pipeline Stage\x1b[0m");
const psLib = join(process.cwd(), "tools/ogu/commands/lib/pipeline-stage.mjs");
assert("pipeline-stage.mjs exists", () => { if (!existsSync(psLib)) throw new Error("missing"); });
const psMod = await import(psLib);
assert("create and execute stages", () => {
  const pipeline = psMod.createPipeline();
  pipeline.addStage("fetch", (data) => ({ ...data, fetched: true }));
  pipeline.addStage("decode", (data) => ({ ...data, decoded: true }));
  const result = pipeline.execute({ instruction: "ADD" });
  if (!result.fetched||!result.decoded) throw new Error("stages should execute");
});
assert("getStages returns stage names", () => {
  const pipeline = psMod.createPipeline();
  pipeline.addStage("A", x=>x); pipeline.addStage("B", x=>x);
  if (pipeline.getStages().length!==2) throw new Error("expected 2");
});
console.log("\n\x1b[36m  Part 2: Hazard Detector\x1b[0m");
const hdLib = join(process.cwd(), "tools/ogu/commands/lib/hazard-detector.mjs");
assert("hazard-detector.mjs exists", () => { if (!existsSync(hdLib)) throw new Error("missing"); });
const hdMod = await import(hdLib);
assert("detects data hazard", () => {
  const hd = hdMod.createHazardDetector();
  hd.addInstruction({ writes: ["R1"], reads: [] });
  hd.addInstruction({ writes: [], reads: ["R1"] });
  const hazards = hd.detect();
  if (hazards.length!==1) throw new Error(`expected 1 hazard, got ${hazards.length}`);
  if (hazards[0].type!=="RAW") throw new Error("should be RAW");
});
assert("no hazard for independent instructions", () => {
  const hd = hdMod.createHazardDetector();
  hd.addInstruction({ writes: ["R1"], reads: [] });
  hd.addInstruction({ writes: ["R2"], reads: [] });
  if (hd.detect().length!==0) throw new Error("should be 0");
});
console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
