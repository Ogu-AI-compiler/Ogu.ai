/**
 * Slice 387 — Playbook Generator Tool
 */

import { buildPlaybookPrompt, validatePlaybook, generateAllMissing } from "../../tools/ogu/commands/lib/playbook-generator.mjs";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 387 — Playbook Generator Tool\x1b[0m\n");

function makeDir() {
  const dir = join(tmpdir(), `ogu-387-${randomUUID().slice(0,8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

assert("buildPlaybookPrompt includes role name and category", () => {
  const prompt = buildPlaybookPrompt({
    roleSlug: "data-engineer",
    displayName: "Data Engineer",
    category: "data",
    exemplars: [],
  });
  if (!prompt.includes("Data Engineer")) throw new Error("missing displayName");
  if (!prompt.includes("data")) throw new Error("missing category");
});

assert("buildPlaybookPrompt includes exemplars when provided", () => {
  const exemplars = [{
    roleSlug: "qa-engineer",
    category: "quality",
    content: "# QA Engineer Playbook\n\nContent here",
  }];
  const prompt = buildPlaybookPrompt({
    roleSlug: "test-automation",
    displayName: "Test Automation Engineer",
    category: "quality",
    exemplars,
  });
  if (!prompt.includes("EXAMPLE: qa-engineer")) throw new Error("missing exemplar");
  if (!prompt.includes("QA Engineer Playbook")) throw new Error("missing exemplar content");
});

assert("buildPlaybookPrompt limits to 3 exemplars", () => {
  const exemplars = Array.from({ length: 5 }, (_, i) => ({
    roleSlug: `role-${i}`,
    category: "test",
    content: `# Role ${i}`,
  }));
  const prompt = buildPlaybookPrompt({
    roleSlug: "some-role",
    displayName: "Some Role",
    category: "test",
    exemplars,
  });
  const count = (prompt.match(/EXAMPLE:/g) || []).length;
  if (count > 3) throw new Error(`got ${count} exemplars, expected max 3`);
});

assert("validatePlaybook passes for valid content", () => {
  const content = `---
role: "Data Engineer"
category: "data"
min_tier: 1
capacity_units: 8
---

# Data Engineer Playbook

## Core Methodology
Deep content about data engineering methodology.
${"Line of content.\n".repeat(100)}

## Checklists
- [ ] ETL pipeline validated

## Anti-Patterns
Do not hardcode connection strings.

## When to Escalate
When data loss is detected.

<!-- skills: data-engineering, etl, sql -->
`;
  const result = validatePlaybook(content, "data-engineer");
  if (!result.valid) throw new Error(`errors: ${result.errors.join(", ")}`);
});

assert("validatePlaybook fails for missing frontmatter", () => {
  const content = `# No Frontmatter
## Core Methodology
Content.
## Checklists
- item
## Anti-Patterns
Bad stuff.
## When to Escalate
Always.
${"Line.\n".repeat(100)}
<!-- skills: a -->`;
  const result = validatePlaybook(content, "test");
  if (result.valid) throw new Error("should fail");
});

assert("validatePlaybook fails for missing sections", () => {
  const content = `---
role: "Test"
---
# Playbook
${"Line.\n".repeat(100)}
<!-- skills: a -->`;
  const result = validatePlaybook(content, "test");
  if (result.valid) throw new Error("should fail");
});

assert("validatePlaybook fails for missing skills marker", () => {
  const content = `---
role: "Test"
---
# Playbook
## Core Methodology
Content.
## Checklists
Items.
## Anti-Patterns
Bad.
## When to Escalate
Sometimes.
${"Line.\n".repeat(100)}`;
  const result = validatePlaybook(content, "test");
  if (result.valid) throw new Error("should fail");
});

assert("validatePlaybook fails for too short content", () => {
  const result = validatePlaybook("short", "test");
  if (result.valid) throw new Error("should fail");
});

assert("validatePlaybook fails for non-string content", () => {
  const result = validatePlaybook(null, "test");
  if (result.valid) throw new Error("should fail");
});

assert("generateAllMissing with dry-run lists missing playbooks", async () => {
  const dir = makeDir();
  mkdirSync(join(dir, "quality"), { recursive: true });
  writeFileSync(join(dir, "quality/qa-engineer.md"), `---
role: "QA Engineer"
category: "quality"
min_tier: 1
capacity_units: 8
---
# QA
## Core Methodology
Test.
## Checklists
- item
## Anti-Patterns
Bad.
## When to Escalate
Always.
${"Line.\n".repeat(100)}
<!-- skills: a -->`, "utf-8");

  const result = await generateAllMissing({ playbooksDir: dir, llmClient: null, dryRun: true });
  if (result.skipped.length === 0) throw new Error("should have skipped existing");
  if (!result.skipped.includes("qa-engineer")) throw new Error("should skip qa-engineer");
  if (result.generated.length < 10) throw new Error("should list many missing");
  rmSync(dir, { recursive: true, force: true });
});

assert("generateAllMissing skips existing playbooks", async () => {
  const dir = makeDir();
  mkdirSync(join(dir, "quality"), { recursive: true });
  writeFileSync(join(dir, "quality/qa-engineer.md"), "content", "utf-8");
  const result = await generateAllMissing({ playbooksDir: dir, llmClient: null, dryRun: true });
  if (!result.skipped.includes("qa-engineer")) throw new Error("should skip existing");
  rmSync(dir, { recursive: true, force: true });
});

assert("generatePlaybook throws without llmClient", async () => {
  const { generatePlaybook } = await import("../../tools/ogu/commands/lib/playbook-generator.mjs");
  let threw = false;
  try {
    await generatePlaybook({ roleSlug: "product-manager", category: "product" });
  } catch (e) {
    threw = true;
    if (!e.message.includes("llmClient")) throw new Error(`wrong error: ${e.message}`);
  }
  if (!threw) throw new Error("should throw");
});

assert("generatePlaybook throws for unknown role", async () => {
  const { generatePlaybook } = await import("../../tools/ogu/commands/lib/playbook-generator.mjs");
  let threw = false;
  try {
    await generatePlaybook({
      roleSlug: "completely-unknown",
      category: "x",
      llmClient: () => ({ content: "test" }),
    });
  } catch { threw = true; }
  if (!threw) throw new Error("should throw");
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
