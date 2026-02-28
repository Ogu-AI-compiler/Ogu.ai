/**
 * Slice 140 — Schema Migration Planner + Data Transformer
 *
 * Schema Migration Planner: plan schema changes with forward/backward steps.
 * Data Transformer: transform data between schema versions.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 140 — Schema Migration Planner + Data Transformer\x1b[0m\n");

// ── Part 1: Schema Migration Planner ──────────────────────────────

console.log("\x1b[36m  Part 1: Schema Migration Planner\x1b[0m");

const smpLib = join(process.cwd(), "tools/ogu/commands/lib/schema-migration-planner.mjs");
assert("schema-migration-planner.mjs exists", () => {
  if (!existsSync(smpLib)) throw new Error("file missing");
});

const smpMod = await import(smpLib);

assert("createMigrationPlanner returns planner", () => {
  if (typeof smpMod.createMigrationPlanner !== "function") throw new Error("missing");
  const planner = smpMod.createMigrationPlanner();
  if (typeof planner.addMigration !== "function") throw new Error("missing addMigration");
  if (typeof planner.plan !== "function") throw new Error("missing plan");
});

assert("addMigration registers a migration", () => {
  const planner = smpMod.createMigrationPlanner();
  planner.addMigration({
    version: 1,
    description: "add user table",
    up: () => "CREATE TABLE users",
    down: () => "DROP TABLE users",
  });
  const migrations = planner.listMigrations();
  if (migrations.length !== 1) throw new Error(`expected 1, got ${migrations.length}`);
});

assert("plan forward returns up steps in order", () => {
  const planner = smpMod.createMigrationPlanner();
  planner.addMigration({ version: 1, description: "v1", up: () => "up1", down: () => "down1" });
  planner.addMigration({ version: 2, description: "v2", up: () => "up2", down: () => "down2" });
  planner.addMigration({ version: 3, description: "v3", up: () => "up3", down: () => "down3" });
  const steps = planner.plan({ from: 0, to: 3 });
  if (steps.length !== 3) throw new Error(`expected 3 steps, got ${steps.length}`);
  if (steps[0].direction !== "up") throw new Error("should be up");
  if (steps[0].version !== 1) throw new Error("should start at v1");
});

assert("plan backward returns down steps in reverse", () => {
  const planner = smpMod.createMigrationPlanner();
  planner.addMigration({ version: 1, description: "v1", up: () => "up1", down: () => "down1" });
  planner.addMigration({ version: 2, description: "v2", up: () => "up2", down: () => "down2" });
  const steps = planner.plan({ from: 2, to: 0 });
  if (steps.length !== 2) throw new Error(`expected 2, got ${steps.length}`);
  if (steps[0].direction !== "down") throw new Error("should be down");
  if (steps[0].version !== 2) throw new Error("should start at v2 going down");
});

// ── Part 2: Data Transformer ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Data Transformer\x1b[0m");

const dtLib = join(process.cwd(), "tools/ogu/commands/lib/data-transformer.mjs");
assert("data-transformer.mjs exists", () => {
  if (!existsSync(dtLib)) throw new Error("file missing");
});

const dtMod = await import(dtLib);

assert("createDataTransformer returns transformer", () => {
  if (typeof dtMod.createDataTransformer !== "function") throw new Error("missing");
  const tf = dtMod.createDataTransformer();
  if (typeof tf.addTransform !== "function") throw new Error("missing addTransform");
  if (typeof tf.transform !== "function") throw new Error("missing transform");
});

assert("transform applies registered function", () => {
  const tf = dtMod.createDataTransformer();
  tf.addTransform("v1-to-v2", (data) => ({ ...data, version: 2, displayName: data.name }));
  const result = tf.transform("v1-to-v2", { name: "Alice", version: 1 });
  if (result.version !== 2) throw new Error("should upgrade version");
  if (result.displayName !== "Alice") throw new Error("should add displayName");
});

assert("chain transforms multiple steps", () => {
  const tf = dtMod.createDataTransformer();
  tf.addTransform("v1-to-v2", (d) => ({ ...d, version: 2 }));
  tf.addTransform("v2-to-v3", (d) => ({ ...d, version: 3, new: true }));
  const result = tf.chain(["v1-to-v2", "v2-to-v3"], { version: 1 });
  if (result.version !== 3) throw new Error("should be v3");
  if (!result.new) throw new Error("should have new field");
});

assert("transform unknown name throws", () => {
  const tf = dtMod.createDataTransformer();
  let threw = false;
  try { tf.transform("nope", {}); } catch { threw = true; }
  if (!threw) throw new Error("should throw for unknown transform");
});

assert("listTransforms returns registered names", () => {
  const tf = dtMod.createDataTransformer();
  tf.addTransform("a", (d) => d);
  tf.addTransform("b", (d) => d);
  const names = tf.listTransforms();
  if (names.length !== 2) throw new Error(`expected 2, got ${names.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
