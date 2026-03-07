/**
 * Slice 397 — Skill Router (lazy loading / task-to-skill routing)
 * Tests: extractTriggers, scoreSkillForTask, routeTask,
 *        buildTaskContext, buildStaticSkillsSection, selectSkillsForRoles,
 *        CLI skills:route
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

console.log("\n\x1b[1mSlice 397 — Skill Router (lazy loading)\x1b[0m\n");

const router = await import(join(process.cwd(), "tools/ogu/commands/lib/skill-router.mjs"));
const {
  extractTriggers, scoreSkillForTask, routeTask,
  buildTaskContext, buildStaticSkillsSection, selectSkillsForRoles,
} = router;

function makeTmpSkillsDir(skills = []) {
  const dir = mkdtempSync(join(tmpdir(), "slice397-skills-"));
  for (const { name, description, body } of skills) {
    mkdirSync(join(dir, name), { recursive: true });
    const frontmatter = `---\nname: ${name}\ndescription: ${description}\n---\n`;
    writeFileSync(join(dir, name, "SKILL.md"), frontmatter + "\n" + (body || `# ${name}\n\n## Workflow\n1. Do the thing.\n`), "utf-8");
  }
  return dir;
}

// ── extractTriggers ────────────────────────────────────────────────────────────
console.log("\n  extractTriggers()");

assert("extracts quoted phrases", () => {
  const d = `Writes code. Use when implementing. Triggers: "implement", "write code", "build feature".`;
  const t = extractTriggers(d);
  if (!t.includes("implement")) throw new Error(`missing 'implement': ${JSON.stringify(t)}`);
  if (!t.includes("write code")) throw new Error("missing 'write code'");
});
assert("handles single-quoted triggers", () => {
  const d = `Does stuff. Use when needed. Triggers: 'do it', 'run it'.`;
  const t = extractTriggers(d);
  if (t.length === 0) throw new Error("no triggers extracted");
});
assert("returns empty array when no Triggers section", () => {
  const t = extractTriggers("Writes code. Use when implementing.");
  if (!Array.isArray(t) || t.length !== 0) throw new Error(`expected empty: ${JSON.stringify(t)}`);
});
assert("returns empty array for null/undefined", () => {
  if (extractTriggers(null).length !== 0) throw new Error("null not handled");
  if (extractTriggers(undefined).length !== 0) throw new Error("undefined not handled");
});
assert("lowercases trigger phrases", () => {
  const t = extractTriggers(`Does X. Use when X. Triggers: "IMPLEMENT IT", "Run Tests".`);
  if (!t.some(x => x === "implement it")) throw new Error(`not lowercased: ${JSON.stringify(t)}`);
});

// ── scoreSkillForTask ──────────────────────────────────────────────────────────
console.log("\n  scoreSkillForTask()");

assert("exact slug match scores highest", () => {
  const skill = { name: "code-implementation", description: "Writes code. Use when implementing. Triggers: \"implement\"." };
  const score = scoreSkillForTask(skill, "I need to implement a new feature");
  if (score <= 0) throw new Error(`score: ${score}`);
});
assert("trigger phrase match gives high score", () => {
  const skill = { name: "debugging", description: "Finds bugs. Use when debugging. Triggers: \"debug\", \"fix bug\"." };
  const high = scoreSkillForTask(skill, "please debug this error");
  const low  = scoreSkillForTask(skill, "design the database schema");
  if (high <= low) throw new Error(`high=${high} not > low=${low}`);
});
assert("unrelated task scores 0 or very low", () => {
  const skill = { name: "kubernetes", description: "Manages k8s. Use when deploying. Triggers: \"kubernetes\", \"k8s deploy\"." };
  const score = scoreSkillForTask(skill, "write a poem");
  if (score > 2) throw new Error(`unexpected score: ${score}`);
});
assert("returns 0 for empty task", () => {
  const skill = { name: "api-design", description: "Designs APIs." };
  if (scoreSkillForTask(skill, "") !== 0) throw new Error("expected 0 for empty");
  if (scoreSkillForTask(skill, null) !== 0) throw new Error("expected 0 for null");
});
assert("returns 0 for null skill", () => {
  if (scoreSkillForTask(null, "implement feature") !== 0) throw new Error("expected 0");
});

// ── routeTask ─────────────────────────────────────────────────────────────────
console.log("\n  routeTask()");

const SAMPLE_SKILLS = [
  { name: "code-implementation", description: "Writes production code. Use when implementing features. Triggers: \"implement\", \"write code\", \"build\"." },
  { name: "debugging",           description: "Finds and fixes bugs. Use when debugging. Triggers: \"debug\", \"fix bug\", \"error in\"." },
  { name: "api-design",          description: "Designs APIs. Use when defining endpoints. Triggers: \"design api\", \"api contract\"." },
  { name: "testing-frontend",    description: "Tests UI. Use when testing frontend. Triggers: \"test frontend\", \"ui test\"." },
  { name: "monitoring",          description: "Observes systems. Use when setting up monitoring. Triggers: \"monitoring\", \"alerts\", \"observability\"." },
];

assert("returns { skills, context, totalMatched }", () => {
  const r = routeTask("implement a login feature", SAMPLE_SKILLS, null, { loadBodies: false });
  if (!Array.isArray(r.skills)) throw new Error("skills not array");
  if (typeof r.context !== "string") throw new Error("context not string");
  if (typeof r.totalMatched !== "number") throw new Error("totalMatched not number");
});
assert("routes implementation task to code-implementation", () => {
  const r = routeTask("implement the user authentication feature", SAMPLE_SKILLS, null, { loadBodies: false });
  const names = r.skills.map(s => s.name);
  if (!names.includes("code-implementation")) throw new Error(`got: ${names}`);
});
assert("routes debug task to debugging skill", () => {
  const r = routeTask("debug this error in the login flow", SAMPLE_SKILLS, null, { loadBodies: false });
  const names = r.skills.map(s => s.name);
  if (!names.includes("debugging")) throw new Error(`got: ${names}`);
});
assert("respects maxSkills limit", () => {
  const r = routeTask("implement and debug and test", SAMPLE_SKILLS, null, { loadBodies: false, maxSkills: 2 });
  if (r.skills.length > 2) throw new Error(`too many: ${r.skills.length}`);
});
assert("returns empty for empty task", () => {
  const r = routeTask("", SAMPLE_SKILLS, null, { loadBodies: false });
  if (r.skills.length !== 0) throw new Error("expected empty");
});
assert("returns empty for empty skillDefs", () => {
  const r = routeTask("implement feature", [], null, { loadBodies: false });
  if (r.skills.length !== 0) throw new Error("expected empty");
});
assert("loads skill body from SKILL.md when skillsDir provided", () => {
  const dir = makeTmpSkillsDir([
    { name: "debugging", description: "Finds bugs. Use when debugging. Triggers: \"debug\".", body: "# Debugging\n\n## Workflow\n1. Reproduce.\n2. Fix.\n" },
  ]);
  const skillDefs = [{ name: "debugging", description: "Finds bugs. Use when debugging. Triggers: \"debug\"." }];
  const r = routeTask("debug this error", skillDefs, dir);
  const debugSkill = r.skills.find(s => s.name === "debugging");
  if (!debugSkill) throw new Error("debugging not matched");
  if (!debugSkill.body) throw new Error("body not loaded");
  if (!debugSkill.body.includes("Reproduce")) throw new Error(`wrong body: ${debugSkill.body}`);
});
assert("scores are attached to matched skills", () => {
  const r = routeTask("debug this error", SAMPLE_SKILLS, null, { loadBodies: false });
  for (const s of r.skills) {
    if (typeof s.score !== "number") throw new Error(`missing score on ${s.name}`);
  }
});

// ── buildTaskContext ──────────────────────────────────────────────────────────
console.log("\n  buildTaskContext()");

assert("returns empty string for empty array", () => {
  if (buildTaskContext([]) !== "") throw new Error("expected empty string");
});
assert("includes ## Active Skills header", () => {
  const ctx = buildTaskContext([{ name: "debugging", description: "Finds bugs.", score: 5 }]);
  if (!ctx.includes("## Active Skills")) throw new Error("missing header");
});
assert("uses body when available (Level 2)", () => {
  const ctx = buildTaskContext([{
    name: "debugging",
    description: "Finds bugs.",
    body: "# Debugging\n\n## Workflow\n1. Reproduce.\n",
    score: 5,
  }]);
  if (!ctx.includes("Reproduce")) throw new Error("body not included");
});
assert("falls back to description when no body (Level 1)", () => {
  const ctx = buildTaskContext([{ name: "api-design", description: "Designs APIs.", score: 3 }]);
  if (!ctx.includes("Designs APIs")) throw new Error("description not shown");
});

// ── buildStaticSkillsSection ──────────────────────────────────────────────────
console.log("\n  buildStaticSkillsSection()");

assert("returns empty string for empty array", () => {
  if (buildStaticSkillsSection([]) !== "") throw new Error("expected empty");
});
assert("includes ## Skill Inventory header", () => {
  const s = buildStaticSkillsSection([{ name: "debugging", description: "Finds bugs." }]);
  if (!s.includes("## Skill Inventory")) throw new Error("missing header");
});
assert("formats each skill as bold name + description", () => {
  const s = buildStaticSkillsSection([{ name: "api-design", description: "Designs APIs." }]);
  if (!s.includes("**api-design**")) throw new Error("bold name missing");
  if (!s.includes("Designs APIs")) throw new Error("description missing");
});

// ── selectSkillsForRoles ──────────────────────────────────────────────────────
console.log("\n  selectSkillsForRoles()");

assert("merges and deduplicates three skill arrays", () => {
  const result = selectSkillsForRoles(
    ["code-implementation", "debugging"],
    ["react", "debugging"],
    ["analytical"]
  );
  const dedupCount = result.filter(s => s === "debugging").length;
  if (dedupCount !== 1) throw new Error(`debugging appears ${dedupCount} times`);
});
assert("respects opts.limit", () => {
  const result = selectSkillsForRoles(["a", "b", "c"], ["d", "e"], ["f"], { limit: 3 });
  if (result.length > 3) throw new Error(`length: ${result.length}`);
});
assert("handles empty arrays", () => {
  const result = selectSkillsForRoles([], [], []);
  if (!Array.isArray(result) || result.length !== 0) throw new Error("expected empty array");
});

// ── CLI skills:route ──────────────────────────────────────────────────────────
console.log("\n  CLI skills:route");

function cli(...args) {
  return execFileSync("node", ["tools/ogu/cli.mjs", ...args], {
    cwd: process.cwd(),
    maxBuffer: 5 * 1024 * 1024,
    encoding: "utf-8",
  });
}

assert("skills:route shows matched skills", () => {
  const out = cli("agents", "skills:route", "implement a REST API endpoint");
  if (!out.includes("Task routing for:")) throw new Error(`output: ${out.slice(0, 300)}`);
  if (!out.includes("score:")) throw new Error("no score in output");
});

assert("skills:route with unrelated task shows 0 or low matches", () => {
  const out = cli("agents", "skills:route", "random xyz task nobody has heard of");
  if (!out.includes("Task routing for:")) throw new Error(`unexpected output: ${out.slice(0, 200)}`);
  // Should not crash even with 0 matches
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
