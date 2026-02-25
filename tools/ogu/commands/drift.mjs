// Drift detection command.
// Usage: ogu drift <slug>

import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";
import { loadIR } from "./lib/ir-registry.mjs";
import { verifyOutput } from "./lib/drift-verifiers.mjs";
import { normalizeIR } from "./lib/normalize-ir.mjs";
import { oguError } from "./lib/errors.mjs";

const IGNORE_DIRS = new Set(["node_modules", "dist", "build", ".next", "coverage", "logs", ".ogu", ".git"]);
const IGNORE_EXTS = /\.log$/;

export async function drift() {
  const args = process.argv.slice(3);
  const slug = args.find((a) => !a.startsWith("--"));

  if (!slug) {
    console.error("Usage: ogu drift <slug>");
    return 1;
  }

  const root = repoRoot();
  const featureDir = join(root, `docs/vault/04_Features/${slug}`);

  if (!existsSync(featureDir)) {
    console.error(`  ERROR  Feature directory not found: docs/vault/04_Features/${slug}/`);
    return 1;
  }

  const errors = [];
  const sections = [];

  // --- 1. IR Output Drift ---
  const ir = loadIR(root, slug);
  const irResults = [];

  if (ir && ir.hasIR()) {
    for (const output of ir.allOutputs) {
      const result = verifyOutput(root, output);
      irResults.push({ output, ...result });
      if (result.status === "missing") {
        errors.push(oguError("OGU1401", { identifier: output, status: "MISSING — " + result.evidence }));
      } else if (result.status === "changed") {
        errors.push(oguError("OGU1401", { identifier: output, status: "CHANGED — " + result.evidence }));
      }
    }
  }

  const irSection = irResults.length > 0
    ? irResults.map((r) => {
        const icon = r.status === "present" ? "\u2705" : r.status === "changed" ? "\u26A0\uFE0F" : "\u274C";
        return `- ${icon} ${r.output} — ${r.evidence}`;
      }).join("\n")
    : "No IR outputs defined (legacy Plan.json)";

  sections.push(`## IR Output Drift\n${irSection}`);

  // --- 2. Contract Drift ---
  const contractResults = [];
  const contractsDir = join(root, "docs/vault/02_Contracts");
  if (existsSync(contractsDir)) {
    try {
      const contractFiles = readdirSync(contractsDir).filter((f) => f.endsWith(".contract.json"));
      for (const file of contractFiles) {
        const contract = readJsonSafe(join(contractsDir, file));
        if (!contract) {
          errors.push(oguError("OGU1403", { contract: file, detail: "invalid JSON" }));
          contractResults.push({ file, status: "invalid", detail: "invalid JSON" });
          continue;
        }
        // Check if contract has matching implementation
        if (contract.endpoints) {
          for (const ep of contract.endpoints) {
            const irId = normalizeIR(`API:${ep.path} ${ep.method || "GET"}`);
            const result = verifyOutput(root, irId);
            if (result.status !== "present") {
              errors.push(oguError("OGU1403", { contract: file, detail: `endpoint ${ep.method || "GET"} ${ep.path} not found` }));
              contractResults.push({ file, status: "drift", detail: `${ep.method || "GET"} ${ep.path} missing` });
            }
          }
        }
        if (contractResults.filter((r) => r.file === file).length === 0) {
          contractResults.push({ file, status: "ok", detail: "all endpoints match" });
        }
      }
    } catch { /* skip */ }
  }

  const contractSection = contractResults.length > 0
    ? contractResults.map((r) => {
        const icon = r.status === "ok" ? "\u2705" : "\u274C";
        return `- ${icon} ${r.file} — ${r.detail}`;
      }).join("\n")
    : "No contract files found";

  sections.push(`## Contract Drift\n${contractSection}`);

  // --- 3. Design Drift ---
  const designResults = [];
  const tokensPath = join(root, "design.tokens.json");
  if (existsSync(tokensPath)) {
    try {
      const tokens = JSON.parse(readFileSync(tokensPath, "utf-8"));
      // Basic check: tokens file is valid and has expected structure
      if (tokens.colors?.primary) {
        designResults.push({ token: "primary color", status: "present", detail: `= ${JSON.stringify(tokens.colors.primary)}` });
      }
    } catch {
      errors.push(oguError("OGU1404", { token: "design.tokens.json", expected: "valid JSON", actual: "parse error" }));
      designResults.push({ token: "design.tokens.json", status: "error", detail: "invalid JSON" });
    }
  }

  const designSection = designResults.length > 0
    ? designResults.map((r) => {
        const icon = r.status === "present" ? "\u2705" : "\u274C";
        return `- ${icon} ${r.token} ${r.detail}`;
      }).join("\n")
    : "No design.tokens.json found (skipped)";

  sections.push(`## Design Drift\n${designSection}`);

  // --- 4. Plan Drift ---
  const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);
  const plan = readJsonSafe(planPath);
  const planResults = [];

  if (plan?.tasks) {
    const allTouches = plan.tasks.flatMap((t) => t.touches || []);
    let missingCount = 0;
    for (const touchPath of allTouches) {
      if (!existsSync(join(root, touchPath))) {
        planResults.push({ path: touchPath, status: "missing" });
        missingCount++;
      }
    }
    if (missingCount === 0) {
      planResults.push({ path: `All ${allTouches.length} touched files`, status: "present" });
    }
  }

  const planSection = planResults.length > 0
    ? planResults.map((r) => {
        const icon = r.status === "present" ? "\u2705" : "\u274C";
        return `- ${icon} ${r.path}${r.status === "missing" ? " — MISSING" : ""}`;
      }).join("\n")
    : "No Plan.json or no touches defined";

  sections.push(`## Plan Drift\n${planSection}`);

  // --- 5. Untracked Files ---
  const allTouches = new Set((plan?.tasks || []).flatMap((t) => t.touches || []));
  const untrackedFiles = [];

  // Scan source directories for files not in any task's touches
  const sourceDirs = ["src", "apps", "packages", "lib", "app", "components"];
  for (const dir of sourceDirs) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    findUntrackedFiles(fullDir, root, allTouches, untrackedFiles);
  }

  if (untrackedFiles.length > 0) {
    for (const f of untrackedFiles.slice(0, 20)) {
      errors.push(oguError("OGU1402", { path: f }));
    }
  }

  const untrackedSection = untrackedFiles.length > 0
    ? `\u26A0\uFE0F ${untrackedFiles.length} untracked file(s):\n` + untrackedFiles.slice(0, 20).map((f) => `- ${f}`).join("\n")
    : "No untracked files detected";

  sections.push(`## Untracked Files\n${untrackedSection}`);

  // --- 6. Recommendation ---
  const recommendations = [];
  const hasIRDrift = irResults.some((r) => r.status !== "present");
  const hasContractDrift = contractResults.some((r) => r.status !== "ok");
  const hasDesignDrift = designResults.some((r) => r.status === "error");

  if (hasIRDrift) recommendations.push("- Fix missing IR outputs or create SCR to document removal");
  if (hasContractDrift) recommendations.push("- Update contracts or implement missing endpoints");
  if (hasDesignDrift) recommendations.push("- Fix design tokens to match implementation");
  if (untrackedFiles.length > 0) recommendations.push("- Add untracked files to Plan.json task touches, or explain in ADR");

  const recSection = recommendations.length > 0
    ? recommendations.join("\n")
    : "No drift detected. Code matches specifications.";

  sections.push(`## Recommendation\n${recSection}`);

  // --- Write report ---
  const report = `# Drift Report: ${slug}\nGenerated: ${new Date().toISOString().split("T")[0]}\n\n${sections.join("\n\n")}\n`;

  const reportPath = join(root, ".ogu/DRIFT_REPORT.md");
  writeFileSync(reportPath, report, "utf-8");

  // Print summary
  const errorCount = errors.filter((e) => e.severity === "error").length;
  const warnCount = errors.filter((e) => e.severity === "warn").length;

  console.log(`\n  Drift Report: ${slug}`);
  console.log(`  IR outputs: ${irResults.filter((r) => r.status === "present").length}/${irResults.length} present`);
  console.log(`  Contracts: ${contractResults.filter((r) => r.status === "ok").length}/${contractResults.length} valid`);
  console.log(`  Untracked: ${untrackedFiles.length} file(s)`);
  console.log(`  Errors: ${errorCount}, Warnings: ${warnCount}`);
  console.log(`  report   .ogu/DRIFT_REPORT.md`);

  if (errorCount > 0) {
    console.log("");
    for (const e of errors.filter((e) => e.severity === "error").slice(0, 10)) {
      console.log(`  \u2716 ${e.message}`);
    }
  }

  return errorCount > 0 ? 1 : 0;
}

function findUntrackedFiles(dir, root, touches, results) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      if (IGNORE_EXTS.test(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      const relPath = fullPath.slice(root.length + 1);
      if (entry.isDirectory()) {
        findUntrackedFiles(fullPath, root, touches, results);
      } else {
        // Check if this file is covered by any touch (exact or prefix match)
        const isTouched = [...touches].some((t) => relPath === t || relPath.startsWith(t + "/") || t.startsWith(relPath));
        if (!isTouched) {
          results.push(relPath);
        }
      }
    }
  } catch { /* skip */ }
}
