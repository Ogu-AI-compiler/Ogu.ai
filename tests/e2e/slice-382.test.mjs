/**
 * Slice 382 — 7 Playbooks + 3 Specialties
 * Validates: files exist, valid frontmatter, >= 200 lines, skills marker present.
 */

import { parsePlaybook, extractSkills } from "../../tools/ogu/commands/lib/playbook-loader.mjs";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 382 — 7 Playbooks + 3 Specialties\x1b[0m\n");

const thisFile = fileURLToPath(import.meta.url);
const repoRoot = join(thisFile, "..", "..", "..");
const pbDir = join(repoRoot, "tools/ogu/playbooks");

const PLAYBOOKS = [
  { path: "product/product-manager.md",     role: "Product Manager",     minLines: 200 },
  { path: "architecture/backend-architect.md", role: "Backend Architect", minLines: 200 },
  { path: "engineering/frontend-developer.md", role: "Frontend Developer", minLines: 200 },
  { path: "quality/qa-engineer.md",          role: "QA Engineer",        minLines: 200 },
  { path: "security/security-architect.md",  role: "Security Architect", minLines: 200 },
  { path: "devops/devops-engineer.md",       role: "DevOps Engineer",    minLines: 200 },
  { path: "expert/scale-performance.md",     role: "Scale & Performance Expert", minLines: 200 },
];

const SPECIALTIES = [
  { path: "specialties/react.md",      name: "React" },
  { path: "specialties/node.md",       name: "Node.js" },
  { path: "specialties/kubernetes.md", name: "Kubernetes" },
];

for (const pb of PLAYBOOKS) {
  const fullPath = join(pbDir, pb.path);

  assert(`Playbook exists: ${pb.path}`, () => {
    if (!existsSync(fullPath)) throw new Error("file not found");
  });

  assert(`Playbook has valid frontmatter: ${pb.role}`, () => {
    const content = readFileSync(fullPath, "utf-8");
    const parsed = parsePlaybook(content);
    if (!parsed.frontmatter.role) throw new Error("missing role");
    if (!parsed.frontmatter.category) throw new Error("missing category");
  });

  assert(`Playbook has >= ${pb.minLines} lines: ${pb.role}`, () => {
    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n").length;
    if (lines < pb.minLines) throw new Error(`only ${lines} lines`);
  });

  assert(`Playbook has skills marker: ${pb.role}`, () => {
    const content = readFileSync(fullPath, "utf-8");
    const skills = extractSkills(content);
    if (skills.length === 0) throw new Error("no skills found");
  });

  assert(`Playbook has required sections: ${pb.role}`, () => {
    const content = readFileSync(fullPath, "utf-8");
    if (!content.includes("## Core Methodology")) throw new Error("missing Core Methodology");
    if (!content.includes("## Checklists")) throw new Error("missing Checklists");
    if (!content.includes("## Anti-Patterns")) throw new Error("missing Anti-Patterns");
    if (!content.includes("## When to Escalate")) throw new Error("missing When to Escalate");
  });
}

for (const spec of SPECIALTIES) {
  const fullPath = join(pbDir, spec.path);

  assert(`Specialty exists: ${spec.path}`, () => {
    if (!existsSync(fullPath)) throw new Error("file not found");
  });

  assert(`Specialty has skills marker: ${spec.name}`, () => {
    const content = readFileSync(fullPath, "utf-8");
    const skills = extractSkills(content);
    if (skills.length === 0) throw new Error("no skills found");
  });

  assert(`Specialty has >= 30 lines: ${spec.name}`, () => {
    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n").length;
    if (lines < 30) throw new Error(`only ${lines} lines`);
  });
}

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
