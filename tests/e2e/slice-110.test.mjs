/**
 * Slice 110 — Contract Doc Generator + Contract Schema Validator
 *
 * Contract doc generator: generate .contract.md files from schemas.
 * Contract schema validator: validate data against contract schemas.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 110 — Contract Doc Generator + Contract Schema Validator\x1b[0m\n");

// ── Part 1: Contract Doc Generator ──────────────────────────────

console.log("\x1b[36m  Part 1: Contract Doc Generator\x1b[0m");

const cdLib = join(process.cwd(), "tools/ogu/commands/lib/contract-doc-generator.mjs");
assert("contract-doc-generator.mjs exists", () => {
  if (!existsSync(cdLib)) throw new Error("file missing");
});

const cdMod = await import(cdLib);

assert("generateContractDoc returns markdown string", () => {
  if (typeof cdMod.generateContractDoc !== "function") throw new Error("missing");
  const md = cdMod.generateContractDoc({
    name: "OrgSpec",
    version: "2.0",
    description: "Organization specification contract",
    schema: {
      roles: { type: "array", items: { type: "object", required: ["id", "label", "capabilities"] } },
      teams: { type: "array" },
    },
    invariants: [
      "Every role must have a unique id",
      "escalationPath must only contain valid role IDs",
    ],
    examples: [{ id: "pm", label: "Product Manager" }],
  });
  if (typeof md !== "string") throw new Error("should return string");
  if (!md.includes("OrgSpec")) throw new Error("should include name");
  if (!md.includes("invariant")) throw new Error("should include invariants section");
});

assert("generateContractDoc includes schema section", () => {
  const md = cdMod.generateContractDoc({
    name: "Budget",
    version: "1.0",
    description: "Budget tracking contract",
    schema: { dailyLimit: { type: "number" } },
    invariants: ["Daily limit must be positive"],
  });
  if (!md.includes("Schema")) throw new Error("should include Schema section");
  if (!md.includes("dailyLimit")) throw new Error("should include field names");
});

assert("CONTRACT_TEMPLATES lists all contract types", () => {
  if (!Array.isArray(cdMod.CONTRACT_TEMPLATES)) throw new Error("missing");
  const expected = ["OrgSpec", "Budget", "Audit", "Governance", "Kadima"];
  for (const t of expected) {
    if (!cdMod.CONTRACT_TEMPLATES.find(ct => ct.name === t)) throw new Error(`missing ${t}`);
  }
});

assert("generateAllContracts returns map of contract docs", () => {
  if (typeof cdMod.generateAllContracts !== "function") throw new Error("missing");
  const docs = cdMod.generateAllContracts();
  if (Object.keys(docs).length < 5) throw new Error("should have at least 5 contracts");
  for (const [name, md] of Object.entries(docs)) {
    if (typeof md !== "string") throw new Error(`${name} should be string`);
    if (md.length < 50) throw new Error(`${name} too short`);
  }
});

// ── Part 2: Contract Schema Validator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Contract Schema Validator\x1b[0m");

const csLib = join(process.cwd(), "tools/ogu/commands/lib/contract-schema-validator.mjs");
assert("contract-schema-validator.mjs exists", () => {
  if (!existsSync(csLib)) throw new Error("file missing");
});

const csMod = await import(csLib);

assert("validateAgainstContract returns valid for conforming data", () => {
  if (typeof csMod.validateAgainstContract !== "function") throw new Error("missing");
  const result = csMod.validateAgainstContract({
    contract: {
      required: ["id", "name"],
      fields: { id: { type: "string" }, name: { type: "string" } },
    },
    data: { id: "abc", name: "Test" },
  });
  if (!result.valid) throw new Error("should be valid");
  if (result.errors.length !== 0) throw new Error("should have no errors");
});

assert("validateAgainstContract detects missing required fields", () => {
  const result = csMod.validateAgainstContract({
    contract: {
      required: ["id", "name"],
      fields: { id: { type: "string" }, name: { type: "string" } },
    },
    data: { id: "abc" },
  });
  if (result.valid) throw new Error("should be invalid");
  if (result.errors.length !== 1) throw new Error(`expected 1 error, got ${result.errors.length}`);
});

assert("validateAgainstContract detects type mismatches", () => {
  const result = csMod.validateAgainstContract({
    contract: {
      required: ["count"],
      fields: { count: { type: "number" } },
    },
    data: { count: "not-a-number" },
  });
  if (result.valid) throw new Error("should be invalid");
});

assert("validateAgainstContract checks custom invariants", () => {
  const result = csMod.validateAgainstContract({
    contract: {
      required: ["items"],
      fields: { items: { type: "array" } },
      invariants: [(data) => data.items.length > 0 ? null : "items must not be empty"],
    },
    data: { items: [] },
  });
  if (result.valid) throw new Error("should be invalid");
  if (!result.errors.some(e => e.includes("empty"))) throw new Error("should mention empty");
});

assert("validateBatch validates multiple data items", () => {
  if (typeof csMod.validateBatch !== "function") throw new Error("missing");
  const results = csMod.validateBatch({
    contract: { required: ["id"], fields: { id: { type: "string" } } },
    items: [{ id: "a" }, { id: 123 }, { id: "c" }],
  });
  if (results.validCount !== 2) throw new Error(`expected 2 valid, got ${results.validCount}`);
  if (results.invalidCount !== 1) throw new Error(`expected 1 invalid, got ${results.invalidCount}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
