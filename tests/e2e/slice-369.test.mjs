/**
 * Slice 369 — agent-generator.mjs
 * Tests: generateAgent returns valid profile, DNA fields present,
 *        skills merged from 3 layers, system prompt has all 6 sections,
 *        capacity correct per role.
 */

import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 369 — agent-generator\x1b[0m\n");

const mod = await import(join(process.cwd(), "tools/ogu/commands/lib/agent-generator.mjs"));
const { generateAgent, FIRST_NAMES, LAST_NAMES, ROLE_CORE_SKILLS, SPECIALTY_SKILLS, DNA_PROFILES } = mod;

assert("FIRST_NAMES has ≥50 entries", () => {
  if (FIRST_NAMES.length < 50) throw new Error(`got ${FIRST_NAMES.length}`);
});

assert("LAST_NAMES has ≥50 entries", () => {
  if (LAST_NAMES.length < 50) throw new Error(`got ${LAST_NAMES.length}`);
});

assert("generateAgent returns valid profile shape", () => {
  const p = generateAgent({ role: "Engineer", specialty: "backend", tier: 2 });
  if (!p.name)        throw new Error("missing name");
  if (!p.role)        throw new Error("missing role");
  if (!p.specialty)   throw new Error("missing specialty");
  if (!p.dna)         throw new Error("missing dna");
  if (!p.skills)      throw new Error("missing skills");
  if (!p.system_prompt) throw new Error("missing system_prompt");
  if (p.agent_id !== null) throw new Error("agent_id should be null (assigned by store)");
});

assert("DNA has all 6 required fields", () => {
  const p = generateAgent({ role: "PM", specialty: "product", tier: 1 });
  const required = ["work_style","communication_style","risk_appetite","strength_bias","tooling_bias","failure_strategy"];
  for (const f of required) {
    if (!p.dna[f]) throw new Error(`missing dna.${f}`);
  }
});

assert("Skills merged from core + specialty + DNA strength (≥3 skills total)", () => {
  const p = generateAgent({ role: "QA", specialty: "frontend", tier: 3, seed: 42 });
  if (p.skills.length < 3) throw new Error(`only ${p.skills.length} skills`);
});

assert("Skills are unique (no duplicates)", () => {
  const p = generateAgent({ role: "Architect", specialty: "distributed", tier: 2, seed: 100 });
  const unique = new Set(p.skills);
  if (unique.size !== p.skills.length) throw new Error("duplicate skills");
});

assert("System prompt has all 6 required sections", () => {
  const p = generateAgent({ role: "DevOps", specialty: "platform", tier: 3, seed: 99 });
  const sections = ["## Identity","## Mission","## Constraints","## Operating Procedure","## Quality Bar","## Escalation Rules"];
  for (const s of sections) {
    if (!p.system_prompt.includes(s)) throw new Error(`missing section: ${s}`);
  }
});

assert("capacity_units correct for PM (6)", () => {
  const p = generateAgent({ role: "PM", specialty: "product", tier: 1 });
  if (p.capacity_units !== 6) throw new Error(`expected 6, got ${p.capacity_units}`);
});

assert("capacity_units correct for Engineer (10)", () => {
  const p = generateAgent({ role: "Engineer", specialty: "backend", tier: 2 });
  if (p.capacity_units !== 10) throw new Error(`expected 10, got ${p.capacity_units}`);
});

assert("capacity_units correct for QA (8)", () => {
  const p = generateAgent({ role: "QA", specialty: "frontend", tier: 2 });
  if (p.capacity_units !== 8) throw new Error(`expected 8, got ${p.capacity_units}`);
});

assert("base_price is positive number", () => {
  const p = generateAgent({ role: "Security", specialty: "security-audit", tier: 4 });
  if (typeof p.base_price !== "number" || p.base_price <= 0) throw new Error(`bad price: ${p.base_price}`);
});

assert("deterministic with same seed", () => {
  const a = generateAgent({ role: "Engineer", specialty: "backend", tier: 2, seed: 777 });
  const b = generateAgent({ role: "Engineer", specialty: "backend", tier: 2, seed: 777 });
  if (a.name !== b.name) throw new Error(`not deterministic: ${a.name} vs ${b.name}`);
  if (a.dna.work_style !== b.dna.work_style) throw new Error("dna not deterministic");
});

assert("different seeds produce different names (likely)", () => {
  const a = generateAgent({ role: "Engineer", specialty: "backend", tier: 2, seed: 1 });
  const b = generateAgent({ role: "Engineer", specialty: "backend", tier: 2, seed: 999999 });
  // At least one field should differ
  const same = a.name === b.name && JSON.stringify(a.dna) === JSON.stringify(b.dna);
  if (same) throw new Error("identical output from different seeds");
});

assert("status defaults to available", () => {
  const p = generateAgent({ role: "Doc", specialty: "docs-api", tier: 1 });
  if (p.status !== "available") throw new Error(`expected available, got ${p.status}`);
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
