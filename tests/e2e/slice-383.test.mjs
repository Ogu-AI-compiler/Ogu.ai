/**
 * Slice 383 — Role Taxonomy Registry
 */

import { ROLE_TAXONOMY, CATEGORIES, getRolesByCategory, getRoleConfig, isExpertRole, getAllSlugs } from "../../tools/ogu/commands/lib/role-taxonomy.mjs";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 383 — Role Taxonomy Registry\x1b[0m\n");

assert("ROLE_TAXONOMY has 64 entries", () => {
  const count = Object.keys(ROLE_TAXONOMY).length;
  if (count !== 64) throw new Error(`got ${count}`);
});

assert("Every entry has required fields", () => {
  for (const [slug, cfg] of Object.entries(ROLE_TAXONOMY)) {
    if (!cfg.category) throw new Error(`${slug}: missing category`);
    if (!cfg.displayName) throw new Error(`${slug}: missing displayName`);
    if (typeof cfg.minTier !== "number") throw new Error(`${slug}: missing minTier`);
    if (typeof cfg.capacityUnits !== "number") throw new Error(`${slug}: missing capacityUnits`);
  }
});

assert("CATEGORIES is sorted array of unique names", () => {
  if (!Array.isArray(CATEGORIES)) throw new Error("not an array");
  const sorted = [...CATEGORIES].sort();
  if (CATEGORIES.join(",") !== sorted.join(",")) throw new Error("not sorted");
  if (new Set(CATEGORIES).size !== CATEGORIES.length) throw new Error("duplicates");
});

assert("CATEGORIES has at least 7 categories", () => {
  if (CATEGORIES.length < 7) throw new Error(`only ${CATEGORIES.length}`);
});

assert("getRolesByCategory returns roles for engineering", () => {
  const roles = getRolesByCategory("engineering");
  if (roles.length < 5) throw new Error(`only ${roles.length}`);
  for (const r of roles) {
    if (!r.slug) throw new Error("missing slug");
    if (!r.displayName) throw new Error("missing displayName");
  }
});

assert("getRolesByCategory returns empty for unknown category", () => {
  const roles = getRolesByCategory("nonexistent");
  if (roles.length !== 0) throw new Error(`got ${roles.length}`);
});

assert("getRoleConfig returns config for product-manager", () => {
  const cfg = getRoleConfig("product-manager");
  if (!cfg) throw new Error("not found");
  if (cfg.displayName !== "Product Manager") throw new Error(`got ${cfg.displayName}`);
  if (cfg.category !== "product") throw new Error(`got ${cfg.category}`);
});

assert("getRoleConfig returns null for unknown slug", () => {
  const cfg = getRoleConfig("nonexistent-role");
  if (cfg !== null) throw new Error("should be null");
});

assert("isExpertRole returns true for expert roles", () => {
  if (!isExpertRole("scale-performance")) throw new Error("scale-performance should be expert");
  if (!isExpertRole("ai-engineer")) throw new Error("ai-engineer should be expert");
  if (!isExpertRole("distributed-systems")) throw new Error("distributed-systems should be expert");
});

assert("isExpertRole returns false for non-expert roles", () => {
  if (isExpertRole("product-manager")) throw new Error("pm should not be expert");
  if (isExpertRole("frontend-developer")) throw new Error("frontend-dev should not be expert");
  if (isExpertRole("qa-engineer")) throw new Error("qa should not be expert");
});

assert("Expert roles have minTier >= 3", () => {
  for (const [slug, cfg] of Object.entries(ROLE_TAXONOMY)) {
    if (cfg.category === "expert" && cfg.minTier < 3) {
      throw new Error(`${slug}: expert role with minTier ${cfg.minTier}`);
    }
  }
});

assert("getAllSlugs returns all 64 slugs", () => {
  const slugs = getAllSlugs();
  if (slugs.length !== 64) throw new Error(`got ${slugs.length}`);
});

assert("All capacity units are positive", () => {
  for (const [slug, cfg] of Object.entries(ROLE_TAXONOMY)) {
    if (cfg.capacityUnits <= 0) throw new Error(`${slug}: capacity ${cfg.capacityUnits}`);
  }
});

assert("All minTier values are 1-4", () => {
  for (const [slug, cfg] of Object.entries(ROLE_TAXONOMY)) {
    if (cfg.minTier < 1 || cfg.minTier > 4) throw new Error(`${slug}: tier ${cfg.minTier}`);
  }
});

assert("product-manager has minTier 1", () => {
  const cfg = getRoleConfig("product-manager");
  if (cfg.minTier !== 1) throw new Error(`got ${cfg.minTier}`);
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
