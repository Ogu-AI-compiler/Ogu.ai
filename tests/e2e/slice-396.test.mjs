/**
 * Slice 396 — Skill Generator (domain-aware template engine)
 * Tests: detectDomain, generateDescription, generateBody,
 *        generateSkillContent, writeSkillFile, generateMissingSkills,
 *        scanPlaybooksForSkills, CLI skills:generate / skills:generate-all
 */

import { join } from "node:path";
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 396 — Skill Generator\x1b[0m\n");

const gen = await import(join(process.cwd(), "tools/ogu/commands/lib/skill-generator.mjs"));
const {
  detectDomain, generateDescription, generateBody,
  generateSkillContent, writeSkillFile, generateMissingSkills,
  scanPlaybooksForSkills, defaultSkillsDir, defaultPlaybooksDir, DOMAINS,
} = gen;

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), "slice396-"));
}

// ── detectDomain ──────────────────────────────────────────────────────────────
console.log("\n  detectDomain()");

assert("react → frontend", () => {
  if (detectDomain("react") !== "frontend") throw new Error(detectDomain("react"));
});
assert("api-design → backend", () => {
  const d = detectDomain("api-design");
  if (d !== "backend") throw new Error(d);
});
assert("kubernetes → ops", () => {
  if (detectDomain("kubernetes") !== "ops") throw new Error(detectDomain("kubernetes"));
});
assert("data-pipelines → data", () => {
  if (detectDomain("data-pipelines") !== "data") throw new Error(detectDomain("data-pipelines"));
});
assert("vulnerability-assessment → security", () => {
  if (detectDomain("vulnerability-assessment") !== "security") throw new Error(detectDomain("vulnerability-assessment"));
});
assert("stakeholder-management → management", () => {
  if (detectDomain("stakeholder-management") !== "management") throw new Error(detectDomain("stakeholder-management"));
});
assert("regression-testing → quality", () => {
  if (detectDomain("regression-testing") !== "quality") throw new Error(detectDomain("regression-testing"));
});
assert("api-documentation → docs", () => {
  if (detectDomain("api-documentation") !== "docs") throw new Error(detectDomain("api-documentation"));
});
assert("event-sourcing → distributed", () => {
  if (detectDomain("event-sourcing") !== "distributed") throw new Error(detectDomain("event-sourcing"));
});
assert("ios → mobile", () => {
  if (detectDomain("ios") !== "mobile") throw new Error(detectDomain("ios"));
});
assert("llm-integration → ml", () => {
  if (detectDomain("llm-integration") !== "ml") throw new Error(detectDomain("llm-integration"));
});
assert("solidity → blockchain", () => {
  if (detectDomain("solidity") !== "blockchain") throw new Error(detectDomain("solidity"));
});
assert("user-research → product", () => {
  if (detectDomain("user-research") !== "product") throw new Error(detectDomain("user-research"));
});
assert("game-ai → game", () => {
  if (detectDomain("game-ai") !== "game") throw new Error(detectDomain("game-ai"));
});

// ── generateDescription ───────────────────────────────────────────────────────
console.log("\n  generateDescription()");

assert("returns non-empty string", () => {
  const d = generateDescription("api-design", "backend");
  if (!d || d.length === 0) throw new Error("empty");
});
assert("contains 'Use when'", () => {
  const d = generateDescription("kubernetes", "ops");
  if (!d.includes("Use when")) throw new Error(`missing: ${d}`);
});
assert("contains 'Triggers:'", () => {
  const d = generateDescription("debugging", "quality");
  if (!d.includes("Triggers:")) throw new Error(`missing: ${d}`);
});
assert("≤1024 chars", () => {
  const d = generateDescription("very-long-skill-name-for-testing-purposes-only", "backend");
  if (d.length > 1024) throw new Error(`too long: ${d.length}`);
});
assert("contains skill words in text", () => {
  const d = generateDescription("api-design", "backend");
  if (!d.toLowerCase().includes("api design")) throw new Error(`missing words: ${d}`);
});

// ── generateBody ──────────────────────────────────────────────────────────────
console.log("\n  generateBody()");

assert("contains ## When to Use", () => {
  const b = generateBody("code-review", "quality");
  if (!b.includes("## When to Use")) throw new Error("missing header");
});
assert("contains ## Workflow", () => {
  const b = generateBody("code-review", "quality");
  if (!b.includes("## Workflow")) throw new Error("missing section");
});
assert("contains ## Quality Bar", () => {
  const b = generateBody("code-review", "quality");
  if (!b.includes("## Quality Bar")) throw new Error("missing section");
});
assert("workflow has numbered steps", () => {
  const b = generateBody("code-review", "quality");
  if (!b.match(/^\d+\./m)) throw new Error("no numbered steps");
});
assert("includeScripts adds ## Scripts section", () => {
  const b = generateBody("api-testing", "backend", { includeScripts: true });
  if (!b.includes("## Scripts")) throw new Error("missing scripts section");
  if (!b.includes("scripts/analyze.mjs")) throw new Error("missing script reference");
  if (!b.includes("lazy loading")) throw new Error("missing lazy loading note");
});
assert("no ## Scripts without flag", () => {
  const b = generateBody("api-testing", "backend");
  if (b.includes("## Scripts")) throw new Error("scripts section should not be present");
});

// ── generateSkillContent ──────────────────────────────────────────────────────
console.log("\n  generateSkillContent()");

assert("returns { frontmatter, body, content, domain }", () => {
  const r = generateSkillContent("react");
  if (!r.frontmatter || !r.body || !r.content || !r.domain) throw new Error(JSON.stringify(r));
});
assert("frontmatter starts with ---", () => {
  const r = generateSkillContent("react");
  if (!r.frontmatter.startsWith("---")) throw new Error(r.frontmatter.slice(0, 50));
});
assert("content contains name in frontmatter", () => {
  const r = generateSkillContent("load-testing");
  if (!r.content.includes("name: load-testing")) throw new Error("name missing");
});
assert("content contains description in frontmatter", () => {
  const r = generateSkillContent("load-testing");
  if (!r.content.includes("description:")) throw new Error("description missing");
});
assert("opts.domain overrides detection", () => {
  const r = generateSkillContent("react", { domain: "quality" });
  if (r.domain !== "quality") throw new Error(`domain: ${r.domain}`);
});
assert("opts.description overrides generation", () => {
  const r = generateSkillContent("my-skill", { description: "Custom desc. Use when X. Triggers: 'x'." });
  if (!r.content.includes("Custom desc.")) throw new Error("custom desc not used");
});

// ── writeSkillFile ────────────────────────────────────────────────────────────
console.log("\n  writeSkillFile()");

assert("writes SKILL.md file", () => {
  const dir = makeTmpDir();
  const r = writeSkillFile(dir, "test-skill");
  if (!r.wrote) throw new Error("wrote=false");
  if (!existsSync(r.path)) throw new Error("file not found");
});
assert("file contains valid frontmatter", () => {
  const dir = makeTmpDir();
  writeSkillFile(dir, "test-skill");
  const content = readFileSync(join(dir, "test-skill", "SKILL.md"), "utf-8");
  if (!content.includes("---")) throw new Error("no frontmatter");
  if (!content.includes("name: test-skill")) throw new Error("name missing");
});
assert("skips existing file by default", () => {
  const dir = makeTmpDir();
  writeSkillFile(dir, "my-skill");
  const r2 = writeSkillFile(dir, "my-skill");
  if (r2.wrote) throw new Error("should skip existing");
  if (r2.reason !== "exists") throw new Error(`reason: ${r2.reason}`);
});
assert("overwrites when opts.overwrite = true", () => {
  const dir = makeTmpDir();
  writeSkillFile(dir, "my-skill");
  writeFileSync(join(dir, "my-skill", "SKILL.md"), "modified content", "utf-8");
  writeSkillFile(dir, "my-skill", { overwrite: true });
  const content = readFileSync(join(dir, "my-skill", "SKILL.md"), "utf-8");
  if (content === "modified content") throw new Error("not overwritten");
});
assert("creates subdirectory if needed", () => {
  const dir = makeTmpDir();
  writeSkillFile(dir, "brand-new-skill");
  if (!existsSync(join(dir, "brand-new-skill"))) throw new Error("dir not created");
});

// ── generateMissingSkills ─────────────────────────────────────────────────────
console.log("\n  generateMissingSkills()");

assert("generates multiple skills", () => {
  const dir = makeTmpDir();
  const { generated, skipped, errors } = generateMissingSkills(dir, ["skill-a", "skill-b", "skill-c"]);
  if (generated.length !== 3) throw new Error(`generated ${generated.length}`);
  if (skipped.length !== 0) throw new Error(`skipped ${skipped.length}`);
  if (errors.length !== 0) throw new Error(`errors: ${JSON.stringify(errors)}`);
});
assert("skips existing skills", () => {
  const dir = makeTmpDir();
  writeSkillFile(dir, "existing");
  const { generated, skipped } = generateMissingSkills(dir, ["existing", "new-one"]);
  if (generated.length !== 1) throw new Error(`generated ${generated.length}`);
  if (skipped.length !== 1) throw new Error(`skipped ${skipped.length}`);
});

// ── scanPlaybooksForSkills ────────────────────────────────────────────────────
console.log("\n  scanPlaybooksForSkills()");

assert("returns empty array for non-existent dir", () => {
  const skills = scanPlaybooksForSkills("/tmp/no-such-dir-xyz-396");
  if (!Array.isArray(skills) || skills.length !== 0) throw new Error("expected empty");
});

assert("extracts skills from markdown files", () => {
  const dir = makeTmpDir();
  mkdirSync(join(dir, "role"), { recursive: true });
  writeFileSync(join(dir, "role", "playbook.md"),
    "# Playbook\n\n<!-- skills: skill-alpha, skill-beta, skill-gamma -->\n\n## Content",
    "utf-8");
  const skills = scanPlaybooksForSkills(dir);
  if (!skills.includes("skill-alpha")) throw new Error(`missing skill-alpha: ${JSON.stringify(skills)}`);
  if (!skills.includes("skill-beta")) throw new Error("missing skill-beta");
  if (!skills.includes("skill-gamma")) throw new Error("missing skill-gamma");
});

assert("deduplicates across files", () => {
  const dir = makeTmpDir();
  writeFileSync(join(dir, "a.md"), "<!-- skills: skill-x, skill-y -->\n", "utf-8");
  writeFileSync(join(dir, "b.md"), "<!-- skills: skill-y, skill-z -->\n", "utf-8");
  const skills = scanPlaybooksForSkills(dir);
  const count = skills.filter(s => s === "skill-y").length;
  if (count !== 1) throw new Error(`duplicate skill-y: ${count} times`);
});

assert("real playbooks dir returns ≥100 skills", () => {
  const pbDir = defaultPlaybooksDir();
  const skills = scanPlaybooksForSkills(pbDir);
  if (skills.length < 100) throw new Error(`only ${skills.length} skills from playbooks`);
});

// ── DOMAINS validation ────────────────────────────────────────────────────────
console.log("\n  DOMAINS schema validation");

assert("all DOMAINS have required keys", () => {
  const required = ["keywords", "verb", "what", "useWhen", "triggers", "workflowSteps", "qualityBar"];
  for (const [name, d] of Object.entries(DOMAINS)) {
    for (const key of required) {
      if (!d[key]) throw new Error(`Domain '${name}' missing key: ${key}`);
    }
  }
});
assert("all DOMAINS have ≥3 workflow steps", () => {
  for (const [name, d] of Object.entries(DOMAINS)) {
    if (!Array.isArray(d.workflowSteps) || d.workflowSteps.length < 3) {
      throw new Error(`Domain '${name}' has fewer than 3 workflow steps`);
    }
  }
});
assert("all DOMAINS have ≥2 quality bar items", () => {
  for (const [name, d] of Object.entries(DOMAINS)) {
    if (!Array.isArray(d.qualityBar) || d.qualityBar.length < 2) {
      throw new Error(`Domain '${name}' has fewer than 2 quality bar items`);
    }
  }
});

// ── CLI tests ─────────────────────────────────────────────────────────────────
console.log("\n  CLI skills:generate and skills:generate-all");

function cli(...args) {
  return execFileSync("node", ["tools/ogu/cli.mjs", ...args], {
    cwd: process.cwd(),
    maxBuffer: 5 * 1024 * 1024,
    encoding: "utf-8",
  });
}

assert("skills:generate creates SKILL.md for a new skill", () => {
  const slug = "slice396-test-xyz";
  const skillDir = join(defaultSkillsDir(), slug);
  if (existsSync(skillDir)) rmSync(skillDir, { recursive: true });
  const out = cli("agents", "skills:generate", slug);
  if (!out.includes("Generated") && !out.includes("Skipped")) throw new Error(`output: ${out}`);
  if (existsSync(skillDir)) rmSync(skillDir, { recursive: true });
});

assert("skills:generate-all shows summary line", () => {
  const out = cli("agents", "skills:generate-all");
  if (!out.includes("Generated:")) throw new Error(`output: ${out.slice(0, 300)}`);
  if (!out.includes("Skills library:")) throw new Error("missing library count");
});

assert("skills:generate-all --from-playbooks scans playbooks", () => {
  const out = cli("agents", "skills:generate-all", "--from-playbooks");
  if (!out.includes("unique skills in playbooks")) throw new Error(`output: ${out.slice(0, 300)}`);
  if (!out.includes("Skills library:")) throw new Error("missing library count");
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
