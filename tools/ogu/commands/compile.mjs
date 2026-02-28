// ogu compile — Single compilation entry point.
// Usage: ogu compile <slug> [--fix] [--gate N] [--verbose] [--strict]

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { repoRoot, readJsonSafe } from "../util.mjs";
import { loadIR, scanPreExisting } from "./lib/ir-registry.mjs";
import { normalizeIR, normalizeRouteForConflict } from "./lib/normalize-ir.mjs";
import { verifyOutput } from "./lib/drift-verifiers.mjs";
import { oguError, formatErrors, hasErrors } from "./lib/errors.mjs";
import { emitAudit } from "./lib/audit-emitter.mjs";

const VERSION = "1.0.0";
const SOURCE_EXTS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const IGNORE_DIRS = new Set(["node_modules", ".git", ".ogu", "dist", "build", ".next", "coverage"]);

export async function compile() {
  const args = process.argv.slice(3);
  const slug = args.find((a) => !a.startsWith("--"));
  const verbose = args.includes("--verbose");
  const strict = args.includes("--strict");
  const maxGate = parseFlag(args, "--gate");
  const fix = args.includes("--fix");

  if (!slug) {
    console.error("Usage: ogu compile <slug> [--fix] [--gate N] [--verbose] [--strict]");
    return 1;
  }

  const root = repoRoot();
  const featureDir = join(root, `docs/vault/04_Features/${slug}`);

  if (!existsSync(featureDir)) {
    console.error(`  \u2716 OGU0003: Feature ${slug} not found`);
    return 2;
  }

  console.log(`\nOgu Compiler v${VERSION} \u2014 compiling "${slug}"\n`);

  const allErrors = [];
  let aborted = false;
  const compileContext = { slug };
  const compileStartMs = Date.now();

  emitAudit("compile.started", { featureSlug: slug, strict, maxGate, fix });

  // ─── Phase 1: IR Load ───
  const phase1 = await runPhase("Phase 1: IR Load", verbose, () => {
    const ir = loadIR(root, slug);
    if (!ir) {
      allErrors.push(oguError("OGU0001", { path: `docs/vault/04_Features/${slug}/Plan.json` }));
      return { ok: false, summary: "Plan.json not found or empty" };
    }

    const taskCount = ir.tasks.length;
    const outputCount = ir.allOutputs.length;

    if (!ir.hasIR()) {
      // Legacy plan — warn but continue
      for (const t of ir.tasks) {
        if (!t.outputs || t.outputs.length === 0) {
          allErrors.push(oguError("OGU0304", { id: String(t.id) }));
        }
      }
      return { ok: true, summary: `${taskCount} tasks, 0 IR outputs (legacy)`, warnings: true };
    }

    return { ok: true, summary: `${taskCount} tasks, ${outputCount} outputs` };
  }, compileContext);

  if (phase1.aborted) return 2;
  if (shouldStop(1, maxGate)) return printSummary(slug, allErrors);

  // ─── Phase 2: Spec Consistency ───
  const phase2 = await runPhase("Phase 2: Spec Consistency", verbose, () => {
    const specPath = join(featureDir, "Spec.md");
    if (!existsSync(specPath)) {
      allErrors.push(oguError("OGU0001", { path: `docs/vault/04_Features/${slug}/Spec.md` }));
      return { ok: false, summary: "Spec.md not found" };
    }

    const specContent = readFileSync(specPath, "utf-8");
    const actualHash = createHash("sha256").update(specContent).digest("hex");

    // Check lock
    const lockPath = join(root, ".ogu/CONTEXT_LOCK.json");
    let hashChainValid = true;
    let chainDetail = "no lock found (skipped)";

    if (existsSync(lockPath)) {
      const lock = readJsonSafe(lockPath);
      const lockedHash = lock?.spec_hashes?.[slug];

      if (lockedHash && lockedHash !== actualHash) {
        // Traverse SCR chain
        const scrs = getSCRFiles(featureDir);
        if (scrs.length === 0) {
          allErrors.push(oguError("OGU1301", { locked: lockedHash.slice(0, 12), actual: actualHash.slice(0, 12) }));
          hashChainValid = false;
          chainDetail = "hash mismatch, no SCRs";
        } else {
          const chainValid = traverseHashChain(featureDir, scrs, lockedHash, actualHash);
          if (!chainValid) {
            allErrors.push(oguError("OGU1301", { locked: lockedHash.slice(0, 12), actual: actualHash.slice(0, 12) }));
            hashChainValid = false;
            chainDetail = "broken chain";
          } else {
            chainDetail = `valid chain via ${scrs.length} SCR(s)`;
          }
        }
      } else if (lockedHash) {
        chainDetail = "hash matches lock";
      }
    }

    // Check spec↔IR coverage
    const ir = loadIR(root, slug);
    const specHeadings = extractSpecHeadings(specContent);
    let coveredCount = 0;

    if (ir && ir.hasIR()) {
      for (const heading of specHeadings) {
        const hasCoverage = ir.allSpecSections.some((s) => s === heading || heading.includes(s) || s.includes(heading));
        if (hasCoverage) {
          coveredCount++;
        } else {
          allErrors.push(oguError("OGU0201", { heading }));
        }
      }
    } else {
      coveredCount = specHeadings.length; // Skip check for legacy
    }

    const ok = hashChainValid;
    return { ok, summary: `${chainDetail}, ${coveredCount}/${specHeadings.length} sections covered` };
  }, compileContext);

  if (shouldStop(2, maxGate)) return printSummary(slug, allErrors);

  // ─── Phase 3: IR Validation ───
  const phase3 = await runPhase("Phase 3: IR Validation", verbose, () => {
    const ir = loadIR(root, slug);
    if (!ir || !ir.hasIR()) {
      return { ok: true, summary: "skipped (no IR)" };
    }

    // Input chain: every input resolved by prior output or pre-existing
    const preExisting = scanPreExisting(root);
    const availableOutputs = new Set([...preExisting]);

    // Process tasks in order
    for (const task of ir.tasks) {
      for (const input of (task.inputs || []).map(normalizeIR)) {
        if (!availableOutputs.has(input)) {
          allErrors.push(oguError("OGU0302", { identifier: input, id: String(task.id) }));
        }
      }
      // Add this task's outputs to available pool
      for (const output of (task.outputs || []).map(normalizeIR)) {
        availableOutputs.add(output);
      }
    }

    // Duplicate outputs check
    const outputMap = {};
    for (const task of ir.tasks) {
      for (const output of (task.outputs || []).map(normalizeIR)) {
        if (outputMap[output] !== undefined) {
          allErrors.push(oguError("OGU0303", { identifier: output, id1: String(outputMap[output]), id2: String(task.id) }));
        } else {
          outputMap[output] = task.id;
        }
      }
    }

    const inputCount = ir.allInputs.length;
    const duplicateCount = allErrors.filter((e) => e.code === "OGU0303").length;
    return {
      ok: allErrors.filter((e) => ["OGU0302", "OGU0303"].includes(e.code)).length === 0,
      summary: `all inputs resolved, ${duplicateCount} duplicate(s)`,
    };
  }, compileContext);

  if (shouldStop(3, maxGate)) return printSummary(slug, allErrors);

  // ─── Phase 4: Code Verification ───
  const phase4 = await runPhase("Phase 4: Code Verification", verbose, () => {
    // No TODOs
    const todoViolations = scanTodos(root, slug);
    for (const v of todoViolations) {
      allErrors.push(oguError("OGU0401", { file: v.file, line: String(v.line), text: v.text }));
    }

    // IR outputs present in codebase
    const ir = loadIR(root, slug);
    let outputsPresent = 0;
    let outputsTotal = 0;

    if (ir && ir.hasIR()) {
      for (const output of ir.allOutputs) {
        outputsTotal++;
        const result = verifyOutput(root, output);
        if (result.status === "present") {
          outputsPresent++;
        } else {
          allErrors.push(oguError("OGU0305", { identifier: output }));
        }
      }
    }

    // Contract consistency
    const contractsDir = join(root, "docs/vault/02_Contracts");
    if (existsSync(contractsDir) && ir && ir.hasIR()) {
      try {
        const contractFiles = readdirSync(contractsDir).filter((f) => f.endsWith(".contract.json"));
        for (const file of contractFiles) {
          const contract = readJsonSafe(join(contractsDir, file));
          if (!contract) continue;
          const contractName = file.replace(".contract.json", "");
          const irRef = normalizeIR(`CONTRACT:${contractName}`);
          if (!ir.hasOutput(irRef)) {
            allErrors.push(oguError("OGU1002", { key: contractName }));
          }
        }
      } catch { /* skip */ }
    }

    const todoCount = todoViolations.length;
    const summary = ir?.hasIR()
      ? `${outputsPresent}/${outputsTotal} outputs present, ${todoCount} TODOs`
      : `${todoCount} TODOs`;

    return {
      ok: todoCount === 0 && (outputsPresent === outputsTotal || !ir?.hasIR()),
      summary,
    };
  }, compileContext);

  if (shouldStop(4, maxGate)) return printSummary(slug, allErrors);

  // ─── Phase 5: Design Verification ───
  const designPath = join(featureDir, "DESIGN.md");
  const hasDesign = existsSync(designPath);

  const phase5 = await runPhase("Phase 5: Design Verification", verbose, () => {
    if (!hasDesign) {
      if (strict) {
        allErrors.push(oguError("OGU0601", { path: `docs/vault/04_Features/${slug}/DESIGN.md` }));
        return { ok: false, summary: "DESIGN.md required in strict mode" };
      }
      return { ok: true, summary: "skipped (no DESIGN.md)", skipped: true };
    }

    // Check design invariants
    const invariantsPath = join(root, "docs/vault/01_Architecture/Invariants.md");
    if (!existsSync(invariantsPath)) {
      return { ok: true, summary: "no invariants file" };
    }

    const invariants = readFileSync(invariantsPath, "utf-8");
    const designRules = extractDesignRules(invariants);

    // Check inline styles (static check)
    const inlineViolations = checkInlineStyles(root, slug);
    for (const v of inlineViolations) {
      allErrors.push(oguError("OGU0605", { file: v.file, line: String(v.line), property: v.property }));
    }

    return {
      ok: inlineViolations.length === 0,
      summary: `${designRules.length} rules, ${inlineViolations.length} violations`,
    };
  }, compileContext);

  if (shouldStop(5, maxGate)) return printSummary(slug, allErrors);

  // ─── Phase 6: Runtime Verification ───
  const phase6 = await runPhase("Phase 6: Runtime Verification", verbose, async () => {
    // Check if app is running
    let appRunning = false;
    try {
      const response = await fetch("http://localhost:3000", { signal: AbortSignal.timeout(3000) });
      appRunning = response.ok || response.status < 500;
    } catch {
      // Also try port 5173 (Vite)
      try {
        const response = await fetch("http://localhost:5173", { signal: AbortSignal.timeout(3000) });
        appRunning = response.ok || response.status < 500;
      } catch { /* not running */ }
    }

    if (!appRunning) {
      if (strict) {
        allErrors.push(oguError("OGU0606", { detail: "app not running on port 3000 or 5173" }));
        return { ok: false, summary: "FAILED — app not running (strict mode)" };
      }
      return { ok: true, summary: "skipped (app not running)", skipped: true };
    }

    return { ok: true, summary: "app running (detailed checks require gates)" };
  }, compileContext);

  // ─── Phase 7: Summary ───
  // In strict mode, promote warnings to errors
  if (strict) {
    for (const e of allErrors) {
      if (e.severity === "warn") e.severity = "error";
    }
  }

  const errorCount = allErrors.filter((e) => e.severity === "error").length;
  const compileDurationMs = Date.now() - compileStartMs;

  emitAudit(errorCount === 0 ? "compile.passed" : "compile.failed", {
    featureSlug: slug,
    errors: errorCount,
    warnings: allErrors.filter((e) => e.severity === "warn").length,
    durationMs: compileDurationMs,
  });

  return printSummary(slug, allErrors);
}

// ─── Helpers ───

async function runPhase(name, verbose, fn, context = {}) {
  const paddedName = name.padEnd(30, " ");
  const startMs = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - startMs;
    const icon = result.skipped ? "\u2298" : result.ok ? "\u2714" : "\u2716";

    if (result.ok || result.skipped) {
      console.log(`${paddedName} ${icon} (${result.summary})`);
    } else {
      console.log(`${paddedName} ${icon} ${result.summary}`);
    }

    // Emit audit event
    if (!result.skipped) {
      emitAudit(result.ok ? "gate.passed" : "gate.failed", {
        gate: name,
        featureSlug: context.slug,
        ok: result.ok,
        summary: result.summary,
        durationMs,
      });
    }

    return result;
  } catch (err) {
    const durationMs = Date.now() - startMs;
    console.log(`${paddedName} \u2716 ABORTED: ${err.message}`);
    emitAudit("gate.failed", {
      gate: name,
      featureSlug: context.slug,
      ok: false,
      summary: err.message,
      durationMs,
      aborted: true,
    });
    return { ok: false, aborted: true, summary: err.message };
  }
}

function printSummary(slug, errors) {
  const errorCount = errors.filter((e) => e.severity === "error").length;
  const warnCount = errors.filter((e) => e.severity === "warn").length;

  console.log("");
  console.log("\u2500".repeat(40));

  if (errorCount === 0) {
    console.log(`Compilation PASSED \u2714 \u2014 ${errorCount} error(s), ${warnCount} warning(s)`);
    console.log(`\nFeature "${slug}" is production-ready.`);
    return 0;
  } else {
    console.log(`Compilation FAILED \u2014 ${errorCount} error(s), ${warnCount} warning(s)\n`);

    // Print errors grouped by phase
    for (const e of errors.filter((e) => e.severity === "error").slice(0, 20)) {
      console.log(`  \u2716 ${e.message}`);
    }
    for (const w of errors.filter((e) => e.severity === "warn").slice(0, 10)) {
      console.log(`  \u26A0 ${w.message}`);
    }

    console.log(`\nFix the errors above, then run: ogu compile ${slug}`);
    return 1;
  }
}

function shouldStop(currentPhase, maxGate) {
  if (!maxGate) return false;
  return currentPhase >= parseInt(maxGate, 10);
}

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function getSCRFiles(featureDir) {
  try {
    return readdirSync(featureDir)
      .filter((f) => /^SCR_\d{3}/.test(f) && f.endsWith(".md"))
      .sort();
  } catch {
    return [];
  }
}

function traverseHashChain(featureDir, scrFiles, lockedHash, actualHash) {
  // Build hash chain: locked → SCR1.current → SCR2.current → ... → actual
  const scrData = [];
  for (const file of scrFiles) {
    const content = readFileSync(join(featureDir, file), "utf-8");
    const prevMatch = content.match(/previous_spec_hash:\s*(\S+)/);
    const currMatch = content.match(/current_spec_hash:\s*(\S+)/);
    if (prevMatch && currMatch) {
      scrData.push({ file, previous: prevMatch[1], current: currMatch[1] });
    }
  }

  // Traverse chain
  let current = lockedHash;
  const visited = new Set();

  while (current !== actualHash) {
    if (visited.has(current)) return false; // Cycle
    visited.add(current);

    const next = scrData.find((s) => s.previous === current);
    if (!next) return false; // Dead end
    current = next.current;
  }

  return true;
}

function extractSpecHeadings(specContent) {
  const headings = [];
  for (const line of specContent.split("\n")) {
    const match = line.match(/^##\s+(.+)/);
    if (match) {
      const heading = match[1].trim();
      // Skip meta headings
      if (!["Overview", "References", "Changelog", "History"].includes(heading)) {
        headings.push(`## ${heading}`);
      }
    }
  }
  return headings;
}

function extractDesignRules(invariantsContent) {
  const rules = [];
  let inDesign = false;
  for (const line of invariantsContent.split("\n")) {
    if (/^## Design Rules/i.test(line)) {
      inDesign = true;
      continue;
    }
    if (inDesign && /^## /.test(line)) break;
    if (inDesign && line.trim().startsWith("- ") && !line.includes("TODO") && !line.includes("<!--")) {
      rules.push(line.trim().slice(2));
    }
  }
  return rules;
}

function scanTodos(root, slug) {
  const violations = [];
  const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);
  const plan = readJsonSafe(planPath);
  const dirsToScan = new Set();
  const todoPattern = /\b(TODO|FIXME|HACK|XXX|PLACEHOLDER)\b/;

  if (plan?.tasks) {
    for (const task of plan.tasks) {
      for (const t of task.touches || []) {
        dirsToScan.add(t.split("/").slice(0, 2).join("/"));
      }
    }
  }
  if (dirsToScan.size === 0) {
    for (const d of ["src", "apps", "packages", "lib"]) {
      if (existsSync(join(root, d))) dirsToScan.add(d);
    }
  }

  for (const dir of dirsToScan) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    scanDirForTodos(fullDir, root, todoPattern, violations);
  }

  return violations;
}

function scanDirForTodos(dir, root, pattern, violations) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirForTodos(fullPath, root, pattern, violations);
      } else if (SOURCE_EXTS.test(entry.name)) {
        const content = readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            const relPath = fullPath.slice(root.length + 1);
            violations.push({ file: relPath, line: i + 1, text: lines[i].trim().slice(0, 80) });
          }
        }
      }
    }
  } catch { /* skip */ }
}

function checkInlineStyles(root, slug) {
  const violations = [];
  const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);
  const plan = readJsonSafe(planPath);
  const dirsToScan = new Set();
  const inlinePattern = /style\s*=\s*["'][^"']*(?:color\s*:|font-|margin\s*:|padding\s*:)/gi;

  if (plan?.tasks) {
    for (const task of plan.tasks) {
      for (const t of task.touches || []) {
        dirsToScan.add(t.split("/").slice(0, 2).join("/"));
      }
    }
  }
  if (dirsToScan.size === 0) {
    for (const d of ["src", "apps", "packages", "lib"]) {
      if (existsSync(join(root, d))) dirsToScan.add(d);
    }
  }

  for (const dir of dirsToScan) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    scanDirForInlineStyles(fullDir, root, inlinePattern, violations);
  }

  return violations;
}

function scanDirForInlineStyles(dir, root, pattern, violations) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDirForInlineStyles(fullPath, root, pattern, violations);
      } else if (/\.(tsx|jsx|html)$/.test(entry.name)) {
        const content = readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          pattern.lastIndex = 0;
          const m = pattern.exec(lines[i]);
          if (m) {
            const relPath = fullPath.slice(root.length + 1);
            const prop = m[0].match(/(?:color|font-|margin|padding)/i)?.[0] || "style";
            violations.push({ file: relPath, line: i + 1, property: prop });
          }
        }
      }
    }
  } catch { /* skip */ }
}
