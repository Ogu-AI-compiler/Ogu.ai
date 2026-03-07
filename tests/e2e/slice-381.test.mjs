/**
 * Slice 381 — Specialty Addendum Loader
 */

import { loadSpecialty, listSpecialties, SPECIALTY_CATALOG } from "../../tools/ogu/commands/lib/specialty-loader.mjs";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 381 — Specialty Addendum Loader\x1b[0m\n");

const SAMPLE_SPECIALTY = `# React Specialty Addendum

## Component Patterns
Use functional components.

## Testing
Use React Testing Library.

<!-- skills: react, hooks, component-design -->
`;

function makeDir() {
  const dir = join(tmpdir(), `ogu-381-${randomUUID().slice(0,8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

assert("SPECIALTY_CATALOG has 20+ entries", () => {
  const count = Object.keys(SPECIALTY_CATALOG).length;
  if (count < 20) throw new Error(`got ${count}, expected 20+`);
});

assert("SPECIALTY_CATALOG includes react, node, kubernetes", () => {
  if (!SPECIALTY_CATALOG.react) throw new Error("missing react");
  if (!SPECIALTY_CATALOG.node) throw new Error("missing node");
  if (!SPECIALTY_CATALOG.kubernetes) throw new Error("missing kubernetes");
});

assert("loadSpecialty loads specialty file", () => {
  const dir = makeDir();
  writeFileSync(join(dir, "react.md"), SAMPLE_SPECIALTY, "utf-8");
  const spec = loadSpecialty(dir, "react");
  if (!spec) throw new Error("should return specialty");
  if (spec.slug !== "react") throw new Error(`wrong slug: ${spec.slug}`);
  if (!spec.body.includes("React Specialty")) throw new Error("wrong body");
  rmSync(dir, { recursive: true, force: true });
});

assert("loadSpecialty extracts skills", () => {
  const dir = makeDir();
  writeFileSync(join(dir, "react.md"), SAMPLE_SPECIALTY, "utf-8");
  const spec = loadSpecialty(dir, "react");
  if (spec.skills.length !== 3) throw new Error(`got ${spec.skills.length} skills`);
  if (!spec.skills.includes("react")) throw new Error("missing react skill");
  rmSync(dir, { recursive: true, force: true });
});

assert("loadSpecialty returns null for missing file", () => {
  const dir = makeDir();
  const spec = loadSpecialty(dir, "nonexistent");
  if (spec !== null) throw new Error("should be null");
  rmSync(dir, { recursive: true, force: true });
});

assert("loadSpecialty returns null for null slug", () => {
  const dir = makeDir();
  const spec = loadSpecialty(dir, null);
  if (spec !== null) throw new Error("should be null");
  rmSync(dir, { recursive: true, force: true });
});

assert("loadSpecialty returns null for empty slug", () => {
  const dir = makeDir();
  const spec = loadSpecialty(dir, "");
  if (spec !== null) throw new Error("should be null");
  rmSync(dir, { recursive: true, force: true });
});

assert("listSpecialties returns all md files in directory", () => {
  const dir = makeDir();
  writeFileSync(join(dir, "react.md"), SAMPLE_SPECIALTY, "utf-8");
  writeFileSync(join(dir, "node.md"), "# Node\n<!-- skills: node -->", "utf-8");
  const list = listSpecialties(dir);
  if (list.length !== 2) throw new Error(`got ${list.length}`);
  const slugs = list.map(l => l.slug);
  if (!slugs.includes("react")) throw new Error("missing react");
  if (!slugs.includes("node")) throw new Error("missing node");
  rmSync(dir, { recursive: true, force: true });
});

assert("listSpecialties includes displayName from catalog", () => {
  const dir = makeDir();
  writeFileSync(join(dir, "react.md"), SAMPLE_SPECIALTY, "utf-8");
  const list = listSpecialties(dir);
  const react = list.find(l => l.slug === "react");
  if (react.displayName !== "React") throw new Error(`got displayName: ${react.displayName}`);
  rmSync(dir, { recursive: true, force: true });
});

assert("listSpecialties returns empty for missing directory", () => {
  const list = listSpecialties("/nonexistent/dir");
  if (list.length !== 0) throw new Error("should be empty");
});

assert("listSpecialties returns empty for empty directory", () => {
  const dir = makeDir();
  const list = listSpecialties(dir);
  if (list.length !== 0) throw new Error("should be empty");
  rmSync(dir, { recursive: true, force: true });
});

assert("listSpecialties includes path for each entry", () => {
  const dir = makeDir();
  writeFileSync(join(dir, "kubernetes.md"), "# K8s\n<!-- skills: k8s -->", "utf-8");
  const list = listSpecialties(dir);
  if (!list[0].path.endsWith("kubernetes.md")) throw new Error(`bad path: ${list[0].path}`);
  rmSync(dir, { recursive: true, force: true });
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
