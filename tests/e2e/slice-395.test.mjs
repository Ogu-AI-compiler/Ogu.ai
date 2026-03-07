/**
 * Slice 395 — Skill Library (Claude Skills format)
 * Tests: skill-loader, SKILL.md files, prompt-assembler skills layer,
 *        agent-generator V2 skill_definitions, CLI skills:list/skills:show
 */

import { join } from "node:path";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 395 — Skill Library (Claude Skills format)\x1b[0m\n");

const skillLoader = await import(join(process.cwd(), "tools/ogu/commands/lib/skill-loader.mjs"));
const { loadSkill, resolveSkills, listSkills, autoDescription, parseSkillFrontmatter, defaultSkillsDir } = skillLoader;

// ── Temp dir helpers ─────────────────────────────────────────────────────────
function makeTmpSkillsDir() {
  return mkdtempSync(join(tmpdir(), "slice395-skills-"));
}

function writeSkillFile(skillsDir, name, content) {
  const skillDir = join(skillsDir, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), content, "utf-8");
}

// ── autoDescription ──────────────────────────────────────────────────────────
console.log("\n  autoDescription()");

assert("generates non-empty string", () => {
  const d = autoDescription("code-implementation");
  if (!d || d.length === 0) throw new Error("empty description");
});

assert("includes skill name words", () => {
  const d = autoDescription("api-design");
  if (!d.includes("api design")) throw new Error(`missing 'api design' in: ${d}`);
});

assert("includes trigger phrase pattern", () => {
  const d = autoDescription("debugging");
  if (!d.toLowerCase().includes("trigger")) throw new Error("missing trigger phrase");
});

assert("is under 1024 chars", () => {
  const d = autoDescription("very-long-skill-name-that-is-quite-verbose-indeed");
  if (d.length > 1024) throw new Error(`description too long: ${d.length} chars`);
});

// ── parseSkillFrontmatter ────────────────────────────────────────────────────
console.log("\n  parseSkillFrontmatter()");

assert("parses name and description from frontmatter", () => {
  const content = `---\nname: test-skill\ndescription: Does something useful. Use when needed. Triggers: "do it".\n---\n\n# Body content`;
  const parsed = parseSkillFrontmatter(content);
  if (parsed.name !== "test-skill") throw new Error(`name: ${parsed.name}`);
  if (!parsed.description.includes("Does something")) throw new Error(`description: ${parsed.description}`);
});

assert("extracts body after frontmatter", () => {
  const content = `---\nname: test-skill\ndescription: Test desc.\n---\n\n# Body\nWorkflow here.`;
  const parsed = parseSkillFrontmatter(content);
  if (!parsed.body.includes("Workflow")) throw new Error(`body: ${parsed.body}`);
});

assert("returns null fields when no frontmatter", () => {
  const parsed = parseSkillFrontmatter("# Just a title\nNo frontmatter here.");
  if (parsed.name !== null) throw new Error(`expected null name, got: ${parsed.name}`);
  if (parsed.description !== null) throw new Error("expected null description");
});

assert("strips quotes from frontmatter values", () => {
  const content = `---\nname: "quoted-skill"\ndescription: "Quoted description."\n---\n`;
  const parsed = parseSkillFrontmatter(content);
  if (parsed.name !== "quoted-skill") throw new Error(`name has quotes: ${parsed.name}`);
});

// ── loadSkill ────────────────────────────────────────────────────────────────
console.log("\n  loadSkill()");

assert("returns null when skill does not exist", () => {
  const dir = makeTmpSkillsDir();
  const result = loadSkill(dir, "nonexistent-skill");
  if (result !== null) throw new Error("expected null");
});

assert("returns { name, description, body } from SKILL.md", () => {
  const dir = makeTmpSkillsDir();
  writeSkillFile(dir, "my-skill", `---\nname: my-skill\ndescription: Does my thing. Use when needed. Triggers: "my thing".\n---\n\n# My Skill\n\n## Workflow\n1. Step one.\n`);
  const skill = loadSkill(dir, "my-skill");
  if (!skill) throw new Error("expected skill object");
  if (skill.name !== "my-skill") throw new Error(`name: ${skill.name}`);
  if (!skill.description.includes("Does my thing")) throw new Error(`description: ${skill.description}`);
  if (!skill.body.includes("Step one")) throw new Error(`body: ${skill.body}`);
});

assert("uses auto-description when SKILL.md has no description field", () => {
  const dir = makeTmpSkillsDir();
  writeSkillFile(dir, "bare-skill", `---\nname: bare-skill\n---\n\n# Body only.`);
  const skill = loadSkill(dir, "bare-skill");
  if (!skill) throw new Error("expected skill object");
  if (!skill.description || skill.description.length === 0) throw new Error("expected auto-generated description");
});

// ── resolveSkills ────────────────────────────────────────────────────────────
console.log("\n  resolveSkills()");

assert("returns [{ name, description }] for known and unknown skills", () => {
  const dir = makeTmpSkillsDir();
  writeSkillFile(dir, "skill-a", `---\nname: skill-a\ndescription: Skill A description. Use when A is needed. Triggers: "do A".\n---\n`);
  const result = resolveSkills(dir, ["skill-a", "unknown-skill"]);
  if (result.length !== 2) throw new Error(`expected 2, got ${result.length}`);
  if (!result[0].description.includes("Skill A")) throw new Error(`wrong desc: ${result[0].description}`);
  if (!result[1].name || !result[1].description) throw new Error("unknown skill missing name/description");
});

assert("auto-generates description for unknown skills", () => {
  const dir = makeTmpSkillsDir();
  const result = resolveSkills(dir, ["fancy-capability"]);
  if (!result[0].description.includes("fancy capability")) throw new Error(`auto-desc: ${result[0].description}`);
});

assert("handles empty array", () => {
  const dir = makeTmpSkillsDir();
  const result = resolveSkills(dir, []);
  if (!Array.isArray(result) || result.length !== 0) throw new Error("expected empty array");
});

// ── listSkills ───────────────────────────────────────────────────────────────
console.log("\n  listSkills()");

assert("returns all skill directories", () => {
  const dir = makeTmpSkillsDir();
  writeSkillFile(dir, "skill-x", `---\nname: skill-x\ndescription: X desc. Use when X. Triggers: "x".\n---\n`);
  writeSkillFile(dir, "skill-y", `---\nname: skill-y\ndescription: Y desc. Use when Y. Triggers: "y".\n---\n`);
  const skills = listSkills(dir);
  if (skills.length !== 2) throw new Error(`expected 2, got ${skills.length}`);
});

assert("returns empty array for non-existent directory", () => {
  const skills = listSkills("/tmp/this-does-not-exist-xyz-abc-395");
  if (!Array.isArray(skills) || skills.length !== 0) throw new Error("expected empty array");
});

// ── Real skills library ──────────────────────────────────────────────────────
console.log("\n  Real skills library (tools/ogu/skills/)");

const realSkillsDir = defaultSkillsDir();

assert("defaultSkillsDir resolves to tools/ogu/skills/", () => {
  if (!realSkillsDir.includes("tools/ogu/skills")) throw new Error(`path: ${realSkillsDir}`);
});

assert("library has ≥20 SKILL.md files", () => {
  const skills = listSkills(realSkillsDir);
  if (skills.length < 20) throw new Error(`only ${skills.length} skills in library`);
});

assert("code-implementation has proper SKILL.md (name, description, body)", () => {
  const skill = loadSkill(realSkillsDir, "code-implementation");
  if (!skill) throw new Error("code-implementation SKILL.md not found");
  if (skill.name !== "code-implementation") throw new Error(`name: ${skill.name}`);
  if (skill.description.length < 80) throw new Error("description too short");
  if (!skill.description.toLowerCase().includes("use when")) throw new Error("missing trigger condition");
  if (!skill.body || skill.body.length < 20) throw new Error("body too short or missing");
});

assert("debugging has proper SKILL.md with Triggers phrase", () => {
  const skill = loadSkill(realSkillsDir, "debugging");
  if (!skill) throw new Error("debugging SKILL.md not found");
  if (!skill.description.includes("Triggers:")) throw new Error("missing trigger phrases in description");
});

assert("all SKILL.md descriptions are ≤1024 chars", () => {
  const skills = listSkills(realSkillsDir);
  const violations = skills.filter(s => s.description && s.description.length > 1024);
  if (violations.length > 0) throw new Error(`descriptions too long: ${violations.map(s => s.name).join(", ")}`);
});

assert("all SKILL.md descriptions include 'Use when' trigger condition", () => {
  const skills = listSkills(realSkillsDir).filter(s => s.body !== undefined);
  const missing = skills.filter(s => s.description && !s.description.toLowerCase().includes("use when"));
  if (missing.length > 0) throw new Error(`missing 'Use when': ${missing.map(s => s.name).join(", ")}`);
});

// ── prompt-assembler buildSkillsLayer ────────────────────────────────────────
console.log("\n  prompt-assembler buildSkillsLayer()");

const assembler = await import(join(process.cwd(), "tools/ogu/commands/lib/prompt-assembler.mjs"));
const { buildSkillsLayer, assembleSystemPrompt, countLayers } = assembler;

assert("returns empty string for empty array", () => {
  const result = buildSkillsLayer([]);
  if (result !== "") throw new Error(`expected empty string, got: ${result}`);
});

assert("formats each skill as **name**: description", () => {
  const result = buildSkillsLayer([
    { name: "code-impl", description: "Writes code from specs." },
    { name: "debugging", description: "Finds and fixes bugs." },
  ]);
  if (!result.includes("**code-impl**")) throw new Error("missing bold name");
  if (!result.includes("Writes code from specs.")) throw new Error("missing description");
});

assert("includes '## Skill Definitions' header", () => {
  const result = buildSkillsLayer([{ name: "x", description: "X does things." }]);
  if (!result.includes("## Skill Definitions")) throw new Error("missing section header");
});

assert("assembleSystemPrompt includes skills layer", () => {
  const playbook = { body: "# Role\nCore instructions." };
  const dna = { work_style: "async-first", communication_style: "concise", risk_appetite: "balanced", strength_bias: "analytical", tooling_bias: "cli", failure_strategy: "retry" };
  const skills = [{ name: "api-design", description: "Designs APIs. Use when defining endpoints. Triggers: 'design API'." }];
  const result = assembleSystemPrompt({ playbook, dna, skills });
  if (!result.includes("## Skill Definitions")) throw new Error("skills layer missing from assembled prompt");
  if (!result.includes("**api-design**")) throw new Error("skill name missing from prompt");
});

assert("countLayers adds 1 when skills provided", () => {
  const playbook = { body: "Content." };
  const dna = { work_style: "a", communication_style: "b", risk_appetite: "c", strength_bias: "d", tooling_bias: "e", failure_strategy: "f" };
  const skills = [{ name: "x", description: "X." }];
  const withSkills    = countLayers({ playbook, skills, dna });
  const withoutSkills = countLayers({ playbook, dna });
  if (withSkills !== withoutSkills + 1) throw new Error(`expected ${withoutSkills + 1} layers, got ${withSkills}`);
});

// ── agent-generator V2 skill_definitions ─────────────────────────────────────
console.log("\n  agent-generator V2 skill_definitions");

const genMod = await import(join(process.cwd(), "tools/ogu/commands/lib/agent-generator.mjs"));
const { generateAgentV2 } = genMod;

const pbDir = join(process.cwd(), "tools/ogu/playbooks");

assert("generateAgentV2 returns skill_definitions array", () => {
  const agent = generateAgentV2({ roleSlug: "frontend-developer", tier: 1, playbooksDir: pbDir, skillsDir: realSkillsDir });
  if (!Array.isArray(agent.skill_definitions)) throw new Error("missing skill_definitions");
  if (agent.skill_definitions.length === 0) throw new Error("skill_definitions is empty");
});

assert("skill_definitions items have { name, description }", () => {
  const agent = generateAgentV2({ roleSlug: "frontend-developer", tier: 1, playbooksDir: pbDir, skillsDir: realSkillsDir });
  const first = agent.skill_definitions[0];
  if (!first.name || !first.description) throw new Error(`bad skill_definition: ${JSON.stringify(first)}`);
});

assert("system_prompt includes Skill Definitions section", () => {
  const agent = generateAgentV2({ roleSlug: "frontend-developer", tier: 1, playbooksDir: pbDir, skillsDir: realSkillsDir });
  if (!agent.system_prompt.includes("Skill Definitions")) throw new Error("missing Skill Definitions in prompt");
});

assert("skill from library gets proper description (not auto-generated)", () => {
  const agent = generateAgentV2({ roleSlug: "frontend-developer", tier: 1, playbooksDir: pbDir, skillsDir: realSkillsDir });
  const codeImpl = agent.skill_definitions.find(s => s.name === "code-implementation");
  if (!codeImpl) return; // skill may not be in this playbook — that's OK
  if (codeImpl.description.includes("expertise for technical tasks")) {
    throw new Error("got auto-generated description instead of library description");
  }
});

// ── CLI tests ─────────────────────────────────────────────────────────────────
console.log("\n  CLI skills:list and skills:show");

function cli(...args) {
  return execFileSync("node", ["tools/ogu/cli.mjs", ...args], {
    cwd: process.cwd(),
    maxBuffer: 5 * 1024 * 1024,
    encoding: "utf-8",
  });
}

assert("ogu agents skills:list shows Skill Library header", () => {
  const out = cli("agents", "skills:list");
  if (!out.includes("Skill Library")) throw new Error(`unexpected output: ${out.slice(0, 200)}`);
});

assert("ogu agents skills:list includes code-implementation", () => {
  const out = cli("agents", "skills:list");
  if (!out.includes("code-implementation")) throw new Error("code-implementation not in list");
});

assert("ogu agents skills:show code-implementation shows description", () => {
  const out = cli("agents", "skills:show", "code-implementation");
  if (!out.includes("code-implementation")) throw new Error("name not shown");
  if (!out.toLowerCase().includes("description:")) throw new Error("Description label missing");
});

assert("ogu agents skills:show nonexistent exits non-zero", () => {
  try {
    cli("agents", "skills:show", "nonexistent-skill-xyz-999");
    throw new Error("expected non-zero exit");
  } catch (e) {
    if (e.message === "expected non-zero exit") throw e;
    // process.exit(1) causes execFileSync to throw — expected
  }
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
