/**
 * Slice 386 — Profile Schema Migration
 */

import { migrateProfile, isV2Profile } from "../../tools/ogu/commands/lib/agent-profile-migrate.mjs";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 386 — Profile Schema Migration\x1b[0m\n");

const V1_PROFILE = {
  agent_id: "agent_0001",
  name: "Alex Ashford",
  role: "Engineer",
  specialty: "backend",
  tier: 2,
  dna: { work_style: "async-first" },
  skills: ["code-implementation"],
  system_prompt: "You are Alex...",
  capacity_units: 10,
  base_price: 4,
  performance_multiplier: 1.0,
  stats: { success_rate: 0.8, projects_completed: 0, utilization_units: 0 },
  created_at: "2026-01-01T00:00:00.000Z",
  status: "available",
};

assert("isV2Profile returns false for V1 profile", () => {
  if (isV2Profile(V1_PROFILE)) throw new Error("should be false");
});

assert("isV2Profile returns true for V2 profile", () => {
  const v2 = { ...V1_PROFILE, profile_version: 2 };
  if (!isV2Profile(v2)) throw new Error("should be true");
});

assert("isV2Profile handles null", () => {
  if (isV2Profile(null)) throw new Error("should be false");
});

assert("migrateProfile adds V2 fields", () => {
  const migrated = migrateProfile(V1_PROFILE);
  if (migrated.profile_version !== 2) throw new Error(`got ${migrated.profile_version}`);
  if (migrated.prompt_version !== 0) throw new Error(`got ${migrated.prompt_version}`);
  if (migrated.experience_digest !== "") throw new Error("should be empty string");
  if (migrated.experience_sources_count !== 0) throw new Error("should be 0");
});

assert("migrateProfile adds role_history", () => {
  const migrated = migrateProfile(V1_PROFILE);
  if (!Array.isArray(migrated.role_history)) throw new Error("missing role_history");
  if (migrated.role_history.length !== 1) throw new Error(`got ${migrated.role_history.length}`);
  if (migrated.role_history[0].role !== "Engineer") throw new Error("wrong role");
  if (migrated.role_history[0].tier !== 2) throw new Error("wrong tier");
  if (migrated.role_history[0].to !== null) throw new Error("to should be null");
});

assert("migrateProfile adds role_display", () => {
  const migrated = migrateProfile(V1_PROFILE);
  if (!migrated.role_display) throw new Error("missing role_display");
});

assert("migrateProfile is idempotent", () => {
  const first = migrateProfile(V1_PROFILE);
  const second = migrateProfile(first);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error("not idempotent");
});

assert("migrateProfile preserves existing fields", () => {
  const migrated = migrateProfile(V1_PROFILE);
  if (migrated.agent_id !== "agent_0001") throw new Error("lost agent_id");
  if (migrated.name !== "Alex Ashford") throw new Error("lost name");
  if (migrated.role !== "Engineer") throw new Error("lost role");
  if (migrated.tier !== 2) throw new Error("lost tier");
});

assert("migrateProfile does not overwrite existing V2 fields", () => {
  const partialV2 = { ...V1_PROFILE, prompt_version: 5, experience_digest: "some rules" };
  const migrated = migrateProfile(partialV2);
  if (migrated.prompt_version !== 5) throw new Error(`overwrote prompt_version: ${migrated.prompt_version}`);
  if (migrated.experience_digest !== "some rules") throw new Error("overwrote digest");
});

assert("migrateProfile handles null input", () => {
  const result = migrateProfile(null);
  if (result !== null) throw new Error("should return null");
});

assert("migrateProfile uses created_at for role_history.from", () => {
  const migrated = migrateProfile(V1_PROFILE);
  if (migrated.role_history[0].from !== "2026-01-01T00:00:00.000Z") {
    throw new Error(`got ${migrated.role_history[0].from}`);
  }
});

assert("migrateProfile preserves existing role_history", () => {
  const withHistory = {
    ...V1_PROFILE,
    role_history: [{ role: "QA", tier: 1, from: "2025-01-01", to: "2025-06-01" }],
  };
  const migrated = migrateProfile(withHistory);
  if (migrated.role_history.length !== 1) throw new Error("should preserve existing history");
  if (migrated.role_history[0].role !== "QA") throw new Error("wrong preserved role");
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
