/**
 * Slice 380 — Playbook Loader & Parser
 */

import { parsePlaybook, extractSkills, loadPlaybook, loadPlaybookForRole, listAvailablePlaybooks, ROLE_SLUG_MAP } from "../../tools/ogu/commands/lib/playbook-loader.mjs";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 380 — Playbook Loader & Parser\x1b[0m\n");

const SAMPLE_PLAYBOOK = `---
role: "QA Engineer"
category: "quality"
min_tier: 1
capacity_units: 8
---

# QA Engineer Playbook

## Core Methodology
Test strategy design is critical.
Always profile before optimizing.

## Checklists
- [ ] Test plan exists
- [ ] Regression suite passes

## Anti-Patterns
Do not test implementation details.

## When to Escalate
When data integrity is at risk.

<!-- skills: test-planning, regression-testing, bug-triage, edge-case-detection -->
`;

assert("parsePlaybook extracts frontmatter", () => {
  const pb = parsePlaybook(SAMPLE_PLAYBOOK);
  if (pb.frontmatter.role !== "QA Engineer") throw new Error(`got role: ${pb.frontmatter.role}`);
  if (pb.frontmatter.category !== "quality") throw new Error(`got category: ${pb.frontmatter.category}`);
  if (pb.frontmatter.min_tier !== 1) throw new Error(`got min_tier: ${pb.frontmatter.min_tier}`);
  if (pb.frontmatter.capacity_units !== 8) throw new Error(`got capacity: ${pb.frontmatter.capacity_units}`);
});

assert("parsePlaybook extracts body without frontmatter", () => {
  const pb = parsePlaybook(SAMPLE_PLAYBOOK);
  if (pb.body.includes("---\nrole:")) throw new Error("body contains frontmatter");
  if (!pb.body.includes("# QA Engineer Playbook")) throw new Error("body missing title");
});

assert("parsePlaybook extracts skills", () => {
  const pb = parsePlaybook(SAMPLE_PLAYBOOK);
  if (pb.skills.length !== 4) throw new Error(`got ${pb.skills.length} skills`);
  if (!pb.skills.includes("test-planning")) throw new Error("missing test-planning");
  if (!pb.skills.includes("edge-case-detection")) throw new Error("missing edge-case-detection");
});

assert("parsePlaybook extracts sections", () => {
  const pb = parsePlaybook(SAMPLE_PLAYBOOK);
  if (!pb.sections["Core Methodology"]) throw new Error("missing Core Methodology section");
  if (!pb.sections["Checklists"]) throw new Error("missing Checklists section");
  if (!pb.sections["Anti-Patterns"]) throw new Error("missing Anti-Patterns section");
  if (!pb.sections["When to Escalate"]) throw new Error("missing When to Escalate section");
});

assert("extractSkills returns empty array for no marker", () => {
  const skills = extractSkills("No skills marker here.");
  if (skills.length !== 0) throw new Error(`got ${skills.length} skills`);
});

assert("extractSkills handles single skill", () => {
  const skills = extractSkills("<!-- skills: just-one -->");
  if (skills.length !== 1) throw new Error(`got ${skills.length}`);
  if (skills[0] !== "just-one") throw new Error(`got ${skills[0]}`);
});

assert("parsePlaybook handles no frontmatter", () => {
  const pb = parsePlaybook("# Title\n\nBody here\n<!-- skills: a, b -->");
  if (Object.keys(pb.frontmatter).length !== 0) throw new Error("frontmatter should be empty");
  if (pb.skills.length !== 2) throw new Error(`got ${pb.skills.length} skills`);
});

assert("parsePlaybook throws on non-string input", () => {
  let threw = false;
  try { parsePlaybook(42); } catch { threw = true; }
  if (!threw) throw new Error("should throw");
});

assert("loadPlaybook loads file from disk", () => {
  const dir = join(tmpdir(), `ogu-380-${randomUUID().slice(0,8)}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "test.md"), SAMPLE_PLAYBOOK, "utf-8");
  const pb = loadPlaybook(join(dir, "test.md"));
  if (pb.frontmatter.role !== "QA Engineer") throw new Error("wrong role");
  if (!pb.path) throw new Error("missing path");
  rmSync(dir, { recursive: true, force: true });
});

assert("loadPlaybook throws for missing file", () => {
  let threw = false;
  try { loadPlaybook("/nonexistent/file.md"); } catch { threw = true; }
  if (!threw) throw new Error("should throw");
});

assert("loadPlaybookForRole finds playbook by slug", () => {
  const dir = join(tmpdir(), `ogu-380-${randomUUID().slice(0,8)}`);
  mkdirSync(join(dir, "quality"), { recursive: true });
  writeFileSync(join(dir, "quality/qa-engineer.md"), SAMPLE_PLAYBOOK, "utf-8");
  const pb = loadPlaybookForRole(dir, "qa-engineer");
  if (!pb) throw new Error("should find playbook");
  if (pb.frontmatter.role !== "QA Engineer") throw new Error("wrong role");
  rmSync(dir, { recursive: true, force: true });
});

assert("loadPlaybookForRole returns null for missing role", () => {
  const dir = join(tmpdir(), `ogu-380-${randomUUID().slice(0,8)}`);
  mkdirSync(dir, { recursive: true });
  const pb = loadPlaybookForRole(dir, "nonexistent-role");
  if (pb !== null) throw new Error("should be null");
  rmSync(dir, { recursive: true, force: true });
});

assert("listAvailablePlaybooks returns list", () => {
  const dir = join(tmpdir(), `ogu-380-${randomUUID().slice(0,8)}`);
  mkdirSync(join(dir, "quality"), { recursive: true });
  mkdirSync(join(dir, "product"), { recursive: true });
  writeFileSync(join(dir, "quality/qa-engineer.md"), SAMPLE_PLAYBOOK, "utf-8");
  writeFileSync(join(dir, "product/pm.md"), SAMPLE_PLAYBOOK, "utf-8");
  const list = listAvailablePlaybooks(dir);
  if (list.length !== 2) throw new Error(`got ${list.length}`);
  rmSync(dir, { recursive: true, force: true });
});

assert("listAvailablePlaybooks returns empty for missing dir", () => {
  const list = listAvailablePlaybooks("/nonexistent/dir");
  if (list.length !== 0) throw new Error("should be empty");
});

assert("ROLE_SLUG_MAP has 64 entries", () => {
  const count = Object.keys(ROLE_SLUG_MAP).length;
  if (count !== 64) throw new Error(`got ${count}`);
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
