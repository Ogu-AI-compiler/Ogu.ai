/**
 * Slice 32 — Audit Gap Fixes: verify-ui + Unified detectPhase (P39 + P41)
 *
 * verify-ui: real UI verification command (routes, handlers, forms).
 * Unified detectPhase: single source of truth for phase detection.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice32-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/state/features"), { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({ currentFeature: "verify-test", phase: "build" }));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

// Create source files for verify-ui to scan
mkdirSync(join(tmp, "src/pages"), { recursive: true });
mkdirSync(join(tmp, "src/components"), { recursive: true });

writeFileSync(join(tmp, "src/pages/Home.tsx"), `
export default function Home() {
  return (
    <div>
      <h1>Home</h1>
      <a href="/about">About</a>
      <button onClick={() => alert("hi")}>Click</button>
      <form onSubmit={(e) => e.preventDefault()}>
        <input name="email" />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
`);

writeFileSync(join(tmp, "src/pages/About.tsx"), `
export default function About() {
  return (
    <div>
      <h1>About</h1>
      <a href="/">Home</a>
      <button onClick={() => {}}>Empty Handler</button>
    </div>
  );
}
`);

writeFileSync(join(tmp, "src/components/Broken.tsx"), `
export default function Broken() {
  return (
    <div>
      <a href="#">Bad Link</a>
      <button>No Handler</button>
    </div>
  );
}
`);

// Feature spec
mkdirSync(join(tmp, "docs/vault/features/verify-test"), { recursive: true });
writeFileSync(join(tmp, "docs/vault/features/verify-test/Spec.md"), "# Spec\n## Routes\n- /\n- /about\n");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

const CLI = join(process.cwd(), "tools/ogu/cli.mjs");
const ogu = (cmd, args = []) =>
  execFileSync("node", [CLI, cmd, ...args], {
    cwd: tmp, encoding: "utf8", timeout: 15000,
    maxBuffer: 5 * 1024 * 1024,
    env: { ...process.env, HOME: tmp },
  });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 32 — verify-ui + Unified detectPhase (P39 + P41)\x1b[0m\n");
console.log("  Real UI verification, single phase detection source\n");

// ── Part 1: verify-ui Library ──────────────────────────────

console.log("\x1b[36m  Part 1: verify-ui Library\x1b[0m");

const verifyLib = join(process.cwd(), "tools/ogu/commands/lib/verify-ui.mjs");
assert("verify-ui.mjs exists", () => {
  if (!existsSync(verifyLib)) throw new Error("file missing");
});

const vuiMod = await import(verifyLib);

assert("scanUIFiles returns component analysis", () => {
  if (typeof vuiMod.scanUIFiles !== "function") throw new Error("missing");
  const result = vuiMod.scanUIFiles({ root: tmp });
  if (!Array.isArray(result.files)) throw new Error("no files array");
  if (result.files.length < 2) throw new Error(`expected at least 2 files, got ${result.files.length}`);
});

assert("scanUIFiles detects links, buttons, and forms", () => {
  const result = vuiMod.scanUIFiles({ root: tmp });
  const allLinks = result.files.flatMap(f => f.links || []);
  const allButtons = result.files.flatMap(f => f.buttons || []);
  const allForms = result.files.flatMap(f => f.forms || []);
  if (allLinks.length < 2) throw new Error(`expected links, got ${allLinks.length}`);
  if (allButtons.length < 2) throw new Error(`expected buttons, got ${allButtons.length}`);
  if (allForms.length < 1) throw new Error(`expected forms, got ${allForms.length}`);
});

assert("scanUIFiles detects problems (empty onClick, href=#)", () => {
  const result = vuiMod.scanUIFiles({ root: tmp });
  if (!result.problems || result.problems.length < 1) throw new Error("should detect problems");
  const hasHref = result.problems.some(p => p.type === "bad-link");
  const hasEmptyHandler = result.problems.some(p => p.type === "empty-handler" || p.type === "no-handler");
  if (!hasHref && !hasEmptyHandler) throw new Error("should detect href=# or empty handler");
});

assert("verifyUI returns pass/fail summary", () => {
  if (typeof vuiMod.verifyUI !== "function") throw new Error("missing");
  const result = vuiMod.verifyUI({ root: tmp });
  if (typeof result.passed !== "boolean") throw new Error("no passed field");
  if (typeof result.totalFiles !== "number") throw new Error("no totalFiles");
  if (typeof result.totalProblems !== "number") throw new Error("no totalProblems");
});

// ── Part 2: verify-ui CLI ──────────────────────────────

console.log("\n\x1b[36m  Part 2: verify-ui CLI\x1b[0m");

const oguSafe = (cmd, args = []) => {
  try {
    return execFileSync("node", [CLI, cmd, ...args], {
      cwd: tmp, encoding: "utf8", timeout: 15000,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, HOME: tmp },
    });
  } catch (e) {
    return e.stdout || e.stderr || "";
  }
};

assert("verify-ui command runs via CLI", () => {
  const out = oguSafe("verify-ui");
  if (!out.includes("UI Verification")) throw new Error(`unexpected: ${out}`);
});

assert("verify-ui --json returns structured results", () => {
  const out = oguSafe("verify-ui", ["--json"]);
  const data = JSON.parse(out);
  if (typeof data.passed !== "boolean") throw new Error("no passed");
  if (typeof data.totalFiles !== "number") throw new Error("no totalFiles");
});

// ── Part 3: Unified detectPhase ──────────────────────────────

console.log("\n\x1b[36m  Part 3: Unified detectPhase\x1b[0m");

const phaseLib = join(process.cwd(), "tools/ogu/commands/lib/phase-detector.mjs");
assert("phase-detector.mjs exists", () => {
  if (!existsSync(phaseLib)) throw new Error("file missing");
});

const phaseMod = await import(phaseLib);

assert("detectPhase returns current phase from STATE", () => {
  if (typeof phaseMod.detectPhase !== "function") throw new Error("missing");
  const phase = phaseMod.detectPhase({ root: tmp });
  if (!phase.current) throw new Error("no current phase");
});

assert("detectPhase identifies feature context", () => {
  const phase = phaseMod.detectPhase({ root: tmp });
  if (!phase.feature) throw new Error("no feature context");
  if (phase.feature !== "verify-test") throw new Error(`wrong feature: ${phase.feature}`);
});

assert("PHASE_ORDER lists all phases in order", () => {
  if (!phaseMod.PHASE_ORDER) throw new Error("missing");
  if (!Array.isArray(phaseMod.PHASE_ORDER)) throw new Error("not array");
  if (phaseMod.PHASE_ORDER.length < 5) throw new Error("too few phases");
  if (!phaseMod.PHASE_ORDER.includes("build")) throw new Error("missing build phase");
});

assert("isPhaseAfter correctly compares phases", () => {
  if (typeof phaseMod.isPhaseAfter !== "function") throw new Error("missing");
  if (!phaseMod.isPhaseAfter("build", "idea")) throw new Error("build should be after idea");
  if (phaseMod.isPhaseAfter("idea", "build")) throw new Error("idea should not be after build");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
