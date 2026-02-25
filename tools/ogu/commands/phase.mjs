import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";

const PHASES = ["discovery", "feature", "architect", "preflight", "build", "gates", "deliver"];

const PHASE_PREREQS = {
  discovery: [],
  feature: ["IDEA.md"],
  architect: ["IDEA.md", "PRD.md"],
  preflight: ["IDEA.md", "PRD.md", "Spec.md", "Plan.json"],
  build: ["IDEA.md", "PRD.md", "Spec.md", "Plan.json"],
  gates: ["IDEA.md", "PRD.md", "Spec.md", "Plan.json"],
  deliver: ["IDEA.md", "PRD.md", "Spec.md", "Plan.json"],
};

function detectPhase(root, slug) {
  if (!slug) return "discovery";

  const featureDir = join(root, "docs/vault/04_Features", slug);
  if (!existsSync(featureDir)) return "discovery";

  const has = (f) => existsSync(join(featureDir, f));

  const metrics = readJsonSafe(join(featureDir, "METRICS.json"));
  if (metrics?.completed) return "deliver";

  const gateState = readJsonSafe(join(root, ".ogu/GATE_STATE.json"));
  if (gateState?.feature === slug && Object.keys(gateState.gates || {}).length > 0) return "gates";

  if (has("Plan.json") && has("Spec.md")) {
    try {
      const spec = readFileSync(join(featureDir, "Spec.md"), "utf-8");
      if (!spec.includes("<!-- TO BE FILLED BY /architect -->")) {
        const contextLock = readJsonSafe(join(root, ".ogu/CONTEXT_LOCK.json"));
        if (contextLock) return "build";
        return "preflight";
      }
    } catch { /* fall through */ }
    return "architect";
  }

  if (has("PRD.md")) return "architect";
  if (has("IDEA.md")) return "feature";
  return "discovery";
}

export async function phase() {
  const root = repoRoot();
  const state = readJsonSafe(join(root, ".ogu/STATE.json"));
  const slug = state?.current_task || null;
  const involvement = state?.involvement_level || null;
  const currentPhase = detectPhase(root, slug);
  const phaseIdx = PHASES.indexOf(currentPhase);

  console.log(`\n  Pipeline Phase`);
  console.log(`  Feature: ${slug || "(none)"}`);
  console.log(`  Phase:   ${currentPhase.toUpperCase()}`);
  console.log(`  Involvement: ${involvement || "NOT SET"}`);
  console.log("");

  // Show phase progression
  for (let i = 0; i < PHASES.length; i++) {
    const p = PHASES[i];
    let marker;
    if (i < phaseIdx) marker = "DONE";
    else if (i === phaseIdx) marker = "CURRENT";
    else marker = "PENDING";
    console.log(`  ${marker === "CURRENT" ? ">" : " "} [${i + 1}] ${p.padEnd(12)} ${marker}`);
  }

  // Show prerequisite status for next phase
  if (phaseIdx < PHASES.length - 1) {
    const nextPhase = PHASES[phaseIdx + 1];
    const prereqs = PHASE_PREREQS[nextPhase] || [];
    if (prereqs.length > 0 && slug) {
      const featureDir = join(root, "docs/vault/04_Features", slug);
      console.log(`\n  Next phase (${nextPhase}) requires:`);
      for (const f of prereqs) {
        const exists = existsSync(join(featureDir, f));
        console.log(`    ${exists ? "OK" : "MISSING"}  ${f}`);
      }
    }
  }

  console.log("");
  return 0;
}
