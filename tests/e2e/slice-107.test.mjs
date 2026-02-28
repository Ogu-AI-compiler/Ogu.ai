/**
 * Slice 107 — Model Config Seeder + Model Route Logger
 *
 * Model config seeder: generate default model-config.json from OrgSpec roles.
 * Model route logger: log routing decisions to model-log.jsonl.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 107 — Model Config Seeder + Model Route Logger\x1b[0m\n");

// ── Part 1: Model Config Seeder ──────────────────────────────

console.log("\x1b[36m  Part 1: Model Config Seeder\x1b[0m");

const mcLib = join(process.cwd(), "tools/ogu/commands/lib/model-config-seeder.mjs");
assert("model-config-seeder.mjs exists", () => {
  if (!existsSync(mcLib)) throw new Error("file missing");
});

const mcMod = await import(mcLib);

assert("seedModelConfig returns config", () => {
  if (typeof mcMod.seedModelConfig !== "function") throw new Error("missing");
  const config = mcMod.seedModelConfig();
  if (!config.models) throw new Error("missing models");
  if (!config.routing) throw new Error("missing routing");
});

assert("config has standard model entries", () => {
  const config = mcMod.seedModelConfig();
  const modelIds = config.models.map(m => m.id);
  if (!modelIds.includes("haiku")) throw new Error("missing haiku");
  if (!modelIds.includes("sonnet")) throw new Error("missing sonnet");
  if (!modelIds.includes("opus")) throw new Error("missing opus");
});

assert("routing has per-role defaults", () => {
  const config = mcMod.seedModelConfig();
  if (!config.routing.byRole) throw new Error("missing byRole");
  if (!config.routing.byRole["backend-dev"]) throw new Error("missing backend-dev routing");
  if (!config.routing.byRole["cto"]) throw new Error("missing cto routing");
});

assert("seedModelConfig accepts orgSpec roles override", () => {
  const config = mcMod.seedModelConfig({
    roles: [
      { id: "custom", modelPolicy: { defaultModel: "haiku", escalationChain: ["haiku", "sonnet"] } }
    ]
  });
  if (!config.routing.byRole["custom"]) throw new Error("missing custom role routing");
  if (config.routing.byRole["custom"].defaultModel !== "haiku") throw new Error("wrong default model");
});

assert("config has fallback and escalation settings", () => {
  const config = mcMod.seedModelConfig();
  if (!config.routing.fallbackModel) throw new Error("missing fallbackModel");
  if (!config.routing.escalation) throw new Error("missing escalation config");
  if (typeof config.routing.escalation.maxFailures !== "number") throw new Error("missing maxFailures");
});

// ── Part 2: Model Route Logger ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Model Route Logger\x1b[0m");

const rlLib = join(process.cwd(), "tools/ogu/commands/lib/model-route-logger.mjs");
assert("model-route-logger.mjs exists", () => {
  if (!existsSync(rlLib)) throw new Error("file missing");
});

const rlMod = await import(rlLib);

assert("createModelRouteLogger returns logger", () => {
  if (typeof rlMod.createModelRouteLogger !== "function") throw new Error("missing");
  const rl = rlMod.createModelRouteLogger();
  if (typeof rl.log !== "function") throw new Error("missing log");
  if (typeof rl.getEntries !== "function") throw new Error("missing getEntries");
});

assert("log records routing decision", () => {
  const rl = rlMod.createModelRouteLogger();
  rl.log({ role: "backend-dev", requestedModel: "sonnet", selectedModel: "sonnet", reason: "default", tokensIn: 100, tokensOut: 50 });
  const entries = rl.getEntries();
  if (entries.length !== 1) throw new Error(`expected 1, got ${entries.length}`);
  if (entries[0].selectedModel !== "sonnet") throw new Error("wrong model");
});

assert("log tracks escalations", () => {
  const rl = rlMod.createModelRouteLogger();
  rl.log({ role: "qa", requestedModel: "haiku", selectedModel: "sonnet", reason: "escalation:failure", tokensIn: 200, tokensOut: 100 });
  const escalations = rl.getEscalations();
  if (escalations.length !== 1) throw new Error(`expected 1, got ${escalations.length}`);
});

assert("getStats returns summary", () => {
  const rl = rlMod.createModelRouteLogger();
  rl.log({ role: "dev", requestedModel: "sonnet", selectedModel: "sonnet", reason: "default", tokensIn: 100, tokensOut: 50 });
  rl.log({ role: "dev", requestedModel: "sonnet", selectedModel: "opus", reason: "escalation", tokensIn: 200, tokensOut: 100 });
  const stats = rl.getStats();
  if (stats.totalRequests !== 2) throw new Error(`expected 2, got ${stats.totalRequests}`);
  if (stats.byModel.sonnet !== 1 || stats.byModel.opus !== 1) throw new Error("wrong byModel");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
