import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "../util.mjs";

// Phase 1 files: created by /feature
const FEATURE_FILES = ["PRD.md", "Spec.md", "QA.md"];

// Phase 2 files: created by /architect
const ARCHITECT_FILES = ["Plan.json"];

// All required files for a complete feature
const ALL_FILES = [...FEATURE_FILES, ...ARCHITECT_FILES];

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const TEMPLATES = {
  "PRD.md": (slug) => `# ${slug} — Product Requirements

## Problem


## User Personas


## Requirements


## Success Metrics


## Assumptions


## Open Questions


## Out of Scope

`,

  "Spec.md": (slug) => `# ${slug} — Technical Spec

## Overview


## User Personas & Permissions


## Screens and Interactions


## Edge Cases


## Data Model
<!-- TO BE FILLED BY /architect -->

## API
<!-- TO BE FILLED BY /architect -->

## Mock API
<!-- TO BE FILLED BY /architect -->

## UI Components
<!-- TO BE FILLED BY /architect -->
`,

  "Plan.json": (slug) => `{
  "feature": "${slug}",
  "tasks": []
}
`,

  "QA.md": (slug) => `# ${slug} — QA Checklist

## Happy Path

- [ ]

## Edge Cases

- [ ]

## Assumption Verification


## Regression

- [ ]
`,
};

// ---------------------------------------------------------------------------
// feature:create
// ---------------------------------------------------------------------------

export async function featureCreate() {
  const slug = process.argv[3];
  if (!slug) {
    console.error("Usage: ogu feature:create <slug>");
    return 1;
  }

  const root = repoRoot();
  const featureDir = join(root, "docs/vault/04_Features", slug);

  if (!existsSync(featureDir)) {
    mkdirSync(featureDir, { recursive: true });
  }

  let created = 0;
  let skipped = 0;

  for (const file of ALL_FILES) {
    const fullPath = join(featureDir, file);
    if (existsSync(fullPath)) {
      console.log(`  skipped  ${file} (already exists)`);
      skipped++;
    } else {
      writeFileSync(fullPath, TEMPLATES[file](slug), "utf-8");
      console.log(`  created  ${file}`);
      created++;
    }
  }

  // Auto-update Index.md
  updateIndex(root, slug);

  // Set as active feature in STATE.json
  const statePath = join(root, ".ogu/STATE.json");
  try {
    const state = existsSync(statePath)
      ? JSON.parse(readFileSync(statePath, "utf-8"))
      : {};
    state.current_task = slug;
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
    console.log(`  active   Set as current feature`);
  } catch { /* best-effort */ }

  const relDir = `docs/vault/04_Features/${slug}`;
  console.log("");
  console.log(`Feature "${slug}": ${created} files created, ${skipped} skipped.`);
  console.log(`  path     ${relDir}/`);
  return 0;
}

// ---------------------------------------------------------------------------
// Index.md auto-update
// ---------------------------------------------------------------------------

function updateIndex(root, slug) {
  const indexPath = join(root, "docs/vault/04_Features/Index.md");
  if (!existsSync(indexPath)) {
    const header = `# Features Index\n\n| Feature | Status | Created |\n|---------|--------|---------|\n`;
    writeFileSync(indexPath, header + `| [${slug}](./${slug}/) | new | ${new Date().toISOString().split("T")[0]} |\n`, "utf-8");
    return;
  }

  const content = readFileSync(indexPath, "utf-8");
  if (content.includes(`[${slug}]`)) return;

  const row = `| [${slug}](./${slug}/) | new | ${new Date().toISOString().split("T")[0]} |\n`;
  writeFileSync(indexPath, content.trimEnd() + "\n" + row, "utf-8");
}

// ---------------------------------------------------------------------------
// feature:validate
// ---------------------------------------------------------------------------

export async function featureValidate() {
  const args = process.argv.slice(3);
  const slug = args.find((a) => !a.startsWith("--"));
  const phase = args.includes("--phase-1") ? 1 : args.includes("--phase-2") ? 2 : 0;

  if (!slug) {
    console.error("Usage: ogu feature:validate <slug> [--phase-1 | --phase-2]");
    console.error("  --phase-1  Validate after /feature (PRD, Spec skeleton, QA)");
    console.error("  --phase-2  Validate after /architect (full Spec, Plan.json)");
    console.error("  (default)  Validate everything");
    return 1;
  }

  const root = repoRoot();
  const featureDir = join(root, "docs/vault/04_Features", slug);
  const errors = [];
  const warnings = [];

  // Check directory exists
  if (!existsSync(featureDir)) {
    console.error(`ERROR  Feature directory not found: docs/vault/04_Features/${slug}/`);
    return 1;
  }

  // --- Phase 1 checks (after /feature) ---
  if (phase === 0 || phase === 1) {
    // Check Phase 1 files exist
    for (const file of FEATURE_FILES) {
      const fullPath = join(featureDir, file);
      if (!existsSync(fullPath)) {
        errors.push(`Missing: ${file}`);
      }
    }

    // Check PRD.md has content
    const prdPath = join(featureDir, "PRD.md");
    if (existsSync(prdPath)) {
      const prdContent = readFileSync(prdPath, "utf-8");
      if (!prdContent.includes("## Requirements") || prdContent.match(/## Requirements\s*\n\s*\n\s*(##|$)/)) {
        errors.push("PRD.md has empty Requirements section");
      }
      // Enhanced format checks (warnings only — backward compatible)
      if (!prdContent.includes("## User Personas")) {
        warnings.push("PRD.md has no User Personas section (enhanced format recommended)");
      }
      if (!prdContent.includes("## Assumptions")) {
        warnings.push("PRD.md has no Assumptions section (enhanced format recommended)");
      }
    }

    // Check Spec.md overview is filled
    const specPath = join(featureDir, "Spec.md");
    if (existsSync(specPath)) {
      const specContent = readFileSync(specPath, "utf-8");

      // Check that product sections are filled (Overview, Screens, Edge Cases)
      if (specContent.includes("TODO")) {
        errors.push("Spec.md contains TODO markers");
      }

      // Architect markers are OK in phase 1
      if (phase === 1 && !specContent.includes("<!-- TO BE FILLED BY /architect -->")) {
        warnings.push("Spec.md has no architect markers — was /architect already run?");
      }
      // Enhanced format check (warning only — backward compatible)
      if (!specContent.includes("## User Personas & Permissions")) {
        warnings.push("Spec.md has no User Personas & Permissions section (enhanced format recommended)");
      }
    }

    // Check QA.md has entries
    const qaPath = join(featureDir, "QA.md");
    if (existsSync(qaPath)) {
      const qaContent = readFileSync(qaPath, "utf-8");
      const checkboxes = qaContent.match(/- \[[ x]\]/g);
      if (!checkboxes || checkboxes.length < 2) {
        errors.push("QA.md needs at least 2 test cases");
      }
      // Enhanced format check (warning only — backward compatible)
      if (existsSync(prdPath)) {
        const prdForQA = readFileSync(prdPath, "utf-8");
        if (prdForQA.includes("## Assumptions") && !prdForQA.includes("None")) {
          if (!qaContent.includes("## Assumption Verification")) {
            warnings.push("QA.md has no Assumption Verification section but PRD.md has assumptions");
          }
        }
      }
    }
  }

  // --- Phase 2 checks (after /architect) ---
  if (phase === 0 || phase === 2) {
    // Check Plan.json exists and has tasks
    const planPath = join(featureDir, "Plan.json");
    if (!existsSync(planPath)) {
      if (phase === 2) {
        errors.push("Missing: Plan.json (run /architect first)");
      } else {
        // In full validation, Plan.json might not exist yet — just warn
        warnings.push("Plan.json not found — run /architect to create it");
      }
    } else {
      const planContent = readFileSync(planPath, "utf-8").trim();
      if (!planContent) {
        errors.push("Plan.json is empty");
      } else {
        try {
          const plan = JSON.parse(planContent);
          if (!plan.tasks || plan.tasks.length === 0) {
            if (phase === 2) {
              errors.push("Plan.json has no tasks");
            } else {
              warnings.push("Plan.json has no tasks — run /architect to fill it");
            }
          }
        } catch {
          errors.push("Plan.json is not valid JSON");
        }
      }
    }

    // Check Spec.md architect markers are gone
    const specPath = join(featureDir, "Spec.md");
    if (existsSync(specPath)) {
      const specContent = readFileSync(specPath, "utf-8");
      if (phase === 2 && specContent.includes("<!-- TO BE FILLED BY /architect -->")) {
        errors.push("Spec.md still has unfilled architect sections");
      }
    }
  }

  // Report
  if (errors.length > 0) {
    const phaseLabel = phase === 1 ? " (phase 1: /feature)" : phase === 2 ? " (phase 2: /architect)" : "";
    console.log(`Feature "${slug}"${phaseLabel}: INVALID\n`);
    for (const e of errors) {
      console.log(`  ERROR  ${e}`);
    }
    for (const w of warnings) {
      console.log(`  WARN   ${w}`);
    }
    return 1;
  }

  const phaseLabel = phase === 1 ? " (phase 1)" : phase === 2 ? " (phase 2)" : "";
  console.log(`Feature "${slug}"${phaseLabel}: VALID`);
  for (const w of warnings) {
    console.log(`  WARN   ${w}`);
  }
  return 0;
}
