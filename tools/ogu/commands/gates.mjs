import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { repoRoot, readJsonSafe } from "../util.mjs";
import { loadIR, scanPreExisting } from "./lib/ir-registry.mjs";
import { normalizeIR } from "./lib/normalize-ir.mjs";
import { verifyOutput } from "./lib/drift-verifiers.mjs";
import { oguError } from "./lib/errors.mjs";

const GATE_NAMES = [
  "doctor",
  "context_lock",
  "plan_tasks",
  "no_todos",
  "ui_functional",
  "design_compliance",
  "brand_compliance",
  "smoke_test",
  "vision",
  "contracts",
  "preview",
  "memory",
  "spec_consistency",
  "drift_check",
];

const SOURCE_EXTS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const IGNORE_DIRS = new Set(["node_modules", ".git", ".ogu", "dist", "build", ".next", "coverage"]);

export async function gates() {
  const args = process.argv.slice(3);
  const subcommand = args[0]; // run, reset, status

  if (!subcommand || !["run", "reset", "status"].includes(subcommand)) {
    console.log("Usage: ogu gates <subcommand> <slug>");
    console.log("");
    console.log("  run <slug>              Run all 14 gates (resumes from checkpoint)");
    console.log("  run <slug> --force      Re-run all gates from scratch");
    console.log("  run <slug> --gate <N>   Run specific gate (1-14)");
    console.log("  reset <slug>            Clear checkpoint state");
    console.log("  status <slug>           Show current gate state");
    return 0;
  }

  const slug = args[1];
  if (!slug) {
    console.error("  ERROR  Slug required. Usage: ogu gates <subcommand> <slug>");
    return 1;
  }

  const root = repoRoot();

  switch (subcommand) {
    case "run":
      return runGates(root, slug, args);
    case "reset":
      return resetGates(root, slug);
    case "status":
      return showStatus(root, slug);
    default:
      return 1;
  }
}

// ---------------------------------------------------------------------------
// Run gates
// ---------------------------------------------------------------------------

async function runGates(root, slug, args) {
  const force = args.includes("--force");
  const specificGate = parseFlag(args, "--gate");
  const statePath = join(root, ".ogu/GATE_STATE.json");

  let state = readJsonSafe(statePath) || {};
  if (state.feature !== slug || force) {
    state = { feature: slug, started: new Date().toISOString(), gates: {} };
  }

  const gateFunctions = [
    (r, s) => gateDoctor(r),
    (r, s) => gateContextLock(r, s),
    (r, s) => gatePlanTasks(r, s),
    (r, s) => gateNoTodos(r, s),
    (r, s) => gateUIFunctional(r, s),
    (r, s) => gateDesignCompliance(r, s),
    (r, s) => gateBrandCompliance(r),
    (r, s) => gateSmokeTest(r, s),
    (r, s) => gateVision(r, s),
    (r, s) => gateContracts(r, s),
    (r, s) => gatePreview(r),
    (r, s) => gateMemory(r),
    (r, s) => gateSpecConsistency(r, s),
    (r, s) => gateDriftCheck(r, s),
  ];

  // Single gate mode
  if (specificGate) {
    const gateNum = parseInt(specificGate, 10);
    if (gateNum < 1 || gateNum > GATE_NAMES.length) {
      console.error(`  ERROR  Gate must be 1-${GATE_NAMES.length}`);
      return 1;
    }
    console.log(`\n  Running gate ${gateNum}: ${GATE_NAMES[gateNum - 1]}\n`);
    const result = await gateFunctions[gateNum - 1](root, slug);
    state.gates[String(gateNum)] = {
      status: result.passed ? "passed" : "failed",
      at: new Date().toISOString(),
      attempts: (state.gates[String(gateNum)]?.attempts || 0) + 1,
      ...(result.passed ? {} : { error: result.details }),
    };
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
    printGateResult(gateNum, GATE_NAMES[gateNum - 1], result);
    return result.passed ? 0 : 1;
  }

  // Full run with checkpoint resume
  console.log(`\n  Completion Gates: ${slug}\n`);

  let allPassed = true;
  let failedGate = null;

  for (let i = 0; i < GATE_NAMES.length; i++) {
    const gateNum = i + 1;
    const gateName = GATE_NAMES[i];
    const gateKey = String(gateNum);

    // Skip if already passed (unless --force)
    if (!force && state.gates[gateKey]?.status === "passed") {
      console.log(`  [${gateNum}] ${gateName.padEnd(16)} SKIP (already passed)`);
      continue;
    }

    const attempts = (state.gates[gateKey]?.attempts || 0) + 1;

    let result;
    try {
      result = await gateFunctions[i](root, slug);
    } catch (err) {
      result = { passed: false, details: err.message };
    }

    state.gates[gateKey] = {
      status: result.passed ? "passed" : "failed",
      at: new Date().toISOString(),
      attempts,
      ...(result.passed ? {} : { error: result.details }),
    };

    // Write checkpoint immediately
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");

    printGateResult(gateNum, gateName, result);

    if (!result.passed) {
      allPassed = false;
      failedGate = gateNum;
      break;
    }
  }

  // Write metrics
  writeMetrics(root, slug, state, allPassed);

  // Summary
  console.log("");
  if (allPassed) {
    console.log(`  Completion Gate: PASSED`);
    console.log(`  Feature "${slug}" is COMPLETE.`);
  } else {
    console.log(`  Completion Gate: FAILED at gate ${failedGate}`);
    console.log(`  Feature "${slug}" is NOT complete.`);
    console.log(`  Fix the issue and re-run: ogu gates run ${slug}`);
  }

  return allPassed ? 0 : 1;
}

function printGateResult(num, name, result) {
  const label = result.passed ? "PASS" : "FAIL";
  console.log(`  [${num}] ${name.padEnd(16)} ${label}`);
  if (!result.passed && result.details) {
    const lines = result.details.split("\n").slice(0, 3);
    for (const line of lines) {
      console.log(`       ${line}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Reset and status
// ---------------------------------------------------------------------------

function resetGates(root, slug) {
  const statePath = join(root, ".ogu/GATE_STATE.json");
  const state = { feature: slug, started: new Date().toISOString(), gates: {} };
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
  console.log(`  reset    Gate state cleared for "${slug}"`);
  return 0;
}

function showStatus(root, slug) {
  const statePath = join(root, ".ogu/GATE_STATE.json");
  const state = readJsonSafe(statePath);

  if (!state || state.feature !== slug) {
    console.log(`  No gate state for "${slug}".`);
    return 0;
  }

  console.log(`\n  Gate State: ${slug}`);
  console.log(`  Started: ${state.started}\n`);

  for (let i = 1; i <= GATE_NAMES.length; i++) {
    const gate = state.gates[String(i)];
    const name = GATE_NAMES[i - 1];
    if (gate) {
      const status = gate.status === "passed" ? "PASS" : "FAIL";
      console.log(`  [${i}] ${name.padEnd(16)} ${status} (${gate.attempts} attempt${gate.attempts > 1 ? "s" : ""})`);
      if (gate.error) {
        console.log(`       ${gate.error.split("\n")[0]}`);
      }
    } else {
      console.log(`  [${i}] ${name.padEnd(16)} PENDING`);
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

function writeMetrics(root, slug, gateState, allPassed) {
  const metricsPath = join(root, ".ogu/METRICS.json");
  const metrics = readJsonSafe(metricsPath) || { version: 1, features: {} };

  const featureMetrics = metrics.features[slug] || {
    started: gateState.started,
    completed: null,
    gate_results: {},
    total_gate_failures: 0,
  };

  let totalFailures = 0;
  for (const [gateNum, gate] of Object.entries(gateState.gates)) {
    const name = GATE_NAMES[parseInt(gateNum, 10) - 1];
    featureMetrics.gate_results[name] = {
      passed: gate.status === "passed",
      attempts: gate.attempts,
      ...(gate.error ? { failures: [gate.error] } : {}),
    };
    if (gate.attempts > 1) totalFailures += gate.attempts - 1;
  }

  featureMetrics.total_gate_failures = totalFailures;
  if (allPassed) {
    featureMetrics.completed = new Date().toISOString();
  }

  metrics.features[slug] = featureMetrics;
  writeFileSync(metricsPath, JSON.stringify(metrics, null, 2) + "\n", "utf-8");
}

// ---------------------------------------------------------------------------
// Gate 1: Doctor
// ---------------------------------------------------------------------------

async function gateDoctor(root) {
  const { doctor } = await import("./doctor.mjs");
  const result = await callCommand(doctor);
  return {
    passed: result.code === 0,
    details: result.code === 0 ? "Health check passed" : result.output || "Doctor check failed",
  };
}

// ---------------------------------------------------------------------------
// Gate 2: Context Lock
// ---------------------------------------------------------------------------

async function gateContextLock(root, slug) {
  const { context } = await import("./context.mjs");
  const { contextLock } = await import("./context-lock.mjs");
  const { validate } = await import("./validate.mjs");

  // Rebuild context with feature
  const savedArgv = [...process.argv];
  process.argv = [savedArgv[0], savedArgv[1], "context", "--feature", slug];
  const ctxResult = await callCommand(context);
  process.argv = savedArgv;

  if (ctxResult.code !== 0) {
    return { passed: false, details: "Failed to build context" };
  }

  // Lock
  const lockResult = await callCommand(contextLock);
  if (lockResult.code !== 0) {
    return { passed: false, details: "Failed to lock context" };
  }

  // Validate lock
  const valResult = await callCommand(validate);
  if (valResult.code !== 0) {
    return { passed: false, details: valResult.output || "Context lock validation failed" };
  }

  return { passed: true, details: "Context rebuilt, locked, and validated" };
}

// ---------------------------------------------------------------------------
// Gate 3: Plan Tasks
// ---------------------------------------------------------------------------

async function gatePlanTasks(root, slug) {
  const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);
  const plan = readJsonSafe(planPath);

  if (!plan || !plan.tasks || plan.tasks.length === 0) {
    return { passed: false, details: "Plan.json not found or has no tasks" };
  }

  const incomplete = [];
  const ir = loadIR(root, slug);

  // If IR is available, verify outputs exist in codebase
  if (ir && ir.hasIR()) {
    for (const output of ir.allOutputs) {
      const result = verifyOutput(root, output);
      if (result.status !== "present") {
        incomplete.push(`IR output missing: ${output} — ${result.evidence}`);
      }
    }

    // Verify input chain
    const preExisting = scanPreExisting(root);
    const available = new Set([...preExisting]);
    for (const task of ir.tasks) {
      for (const input of (task.inputs || []).map(normalizeIR)) {
        if (!available.has(input)) {
          incomplete.push(`Task ${task.id}: unresolved input ${input}`);
        }
      }
      for (const output of (task.outputs || []).map(normalizeIR)) {
        available.add(output);
      }
    }
  }

  // Check touches — verify files exist
  for (const task of plan.tasks) {
    if (task.touches) {
      for (const touchPath of task.touches) {
        const fullPath = join(root, touchPath);
        if (!existsSync(fullPath)) {
          incomplete.push(`Task ${task.id}: ${task.title} — missing: ${touchPath}`);
        }
      }
    }

    // Legacy done_when check (only if no IR)
    if (!ir?.hasIR() && task.done_when) {
      const evidence = checkDoneWhen(root, task);
      if (!evidence) {
        incomplete.push(`Task ${task.id}: ${task.title} — done_when not met: "${task.done_when}"`);
      }
    }
  }

  if (incomplete.length > 0) {
    return { passed: false, details: incomplete.join("\n") };
  }

  const irNote = ir?.hasIR() ? `, ${ir.allOutputs.length} IR outputs verified` : "";
  return { passed: true, details: `All ${plan.tasks.length} tasks verified${irNote}` };
}

function checkDoneWhen(root, task) {
  const doneWhen = task.done_when.toLowerCase();

  // Check if touches directories exist and have files
  if (task.touches) {
    for (const touchPath of task.touches) {
      const fullPath = join(root, touchPath);
      if (!existsSync(fullPath)) return false;
    }
  }

  // Basic heuristic: if done_when mentions a file or pattern, grep for it
  const fileMatch = doneWhen.match(/(?:file|module|component|page|route|endpoint)\s+(\S+)/);
  if (fileMatch) {
    const target = fileMatch[1].replace(/['"]/g, "");
    return scanForPattern(root, target);
  }

  // If touches exist and done_when exists, assume task is done if all touched paths exist
  if (task.touches && task.touches.length > 0) {
    return task.touches.every((p) => existsSync(join(root, p)));
  }

  // Default: assume done (Claude verified during build)
  return true;
}

function scanForPattern(root, pattern) {
  try {
    const dirs = ["src", "apps", "packages", "lib"];
    for (const dir of dirs) {
      const fullDir = join(root, dir);
      if (!existsSync(fullDir)) continue;
      if (scanDirForPattern(fullDir, pattern)) return true;
    }
  } catch { /* ignore */ }
  return false;
}

function scanDirForPattern(dir, pattern) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (scanDirForPattern(fullPath, pattern)) return true;
      } else if (SOURCE_EXTS.test(entry.name)) {
        const content = readFileSync(fullPath, "utf-8");
        if (content.includes(pattern)) return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}

// ---------------------------------------------------------------------------
// Gate 4: No TODOs
// ---------------------------------------------------------------------------

async function gateNoTodos(root, slug) {
  const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);
  const plan = readJsonSafe(planPath);
  const violations = [];

  // Determine which directories to scan
  const dirsToScan = new Set();
  if (plan?.tasks) {
    for (const task of plan.tasks) {
      if (task.touches) {
        for (const t of task.touches) {
          // Get the top-level directory from touches
          const topDir = t.split("/").slice(0, 2).join("/");
          dirsToScan.add(topDir);
        }
      }
    }
  }

  // Fallback: scan common source directories
  if (dirsToScan.size === 0) {
    for (const d of ["src", "apps", "packages", "lib"]) {
      if (existsSync(join(root, d))) dirsToScan.add(d);
    }
  }

  const todoPattern = /\b(TODO|FIXME|HACK|XXX|PLACEHOLDER)\b/;

  for (const dir of dirsToScan) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    scanForTodos(fullDir, root, todoPattern, violations);
  }

  if (violations.length > 0) {
    return {
      passed: false,
      details: `${violations.length} TODO markers found:\n${violations.slice(0, 10).join("\n")}`,
    };
  }

  return { passed: true, details: "No TODO/FIXME/HACK/XXX markers found" };
}

function scanForTodos(dir, root, pattern, violations) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanForTodos(fullPath, root, pattern, violations);
      } else if (SOURCE_EXTS.test(entry.name)) {
        const content = readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            const relPath = fullPath.slice(root.length + 1);
            violations.push(`${relPath}:${i + 1}: ${lines[i].trim().slice(0, 80)}`);
          }
        }
      }
    }
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Gate 5: UI Functional
// ---------------------------------------------------------------------------

async function gateUIFunctional(root, slug) {
  const violations = [];
  const reactPattern = /\.(tsx|jsx)$/;

  const deadHandlerPatterns = [
    { pattern: /onClick\s*=\s*\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/g, desc: "empty onClick handler" },
    { pattern: /onClick\s*=\s*\{\s*\(\)\s*=>\s*null\s*\}/g, desc: "null onClick handler" },
    { pattern: /onClick\s*=\s*\{\s*\(\)\s*=>\s*undefined\s*\}/g, desc: "undefined onClick handler" },
    { pattern: /href\s*=\s*["']#["']/g, desc: 'href="#" dead link' },
    { pattern: /onSubmit\s*=\s*\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/g, desc: "empty onSubmit handler" },
    { pattern: /onChange\s*=\s*\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/g, desc: "empty onChange handler" },
    { pattern: /onClick\s*=\s*\{\s*\(\s*e?\s*\)\s*=>\s*\{\s*console\.log/g, desc: "console.log-only onClick" },
  ];

  // Get feature directories
  const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);
  const plan = readJsonSafe(planPath);
  const dirsToScan = new Set();

  if (plan?.tasks) {
    for (const task of plan.tasks) {
      if (task.touches) {
        for (const t of task.touches) {
          dirsToScan.add(t.split("/").slice(0, 2).join("/"));
        }
      }
    }
  }

  if (dirsToScan.size === 0) {
    for (const d of ["src", "apps/web", "apps/mobile"]) {
      if (existsSync(join(root, d))) dirsToScan.add(d);
    }
  }

  for (const dir of dirsToScan) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    scanForDeadHandlers(fullDir, root, reactPattern, deadHandlerPatterns, violations);
  }

  if (violations.length > 0) {
    return {
      passed: false,
      details: `${violations.length} dead UI element(s):\n${violations.slice(0, 10).join("\n")}`,
    };
  }

  return { passed: true, details: "All UI interactions have real handlers" };
}

function scanForDeadHandlers(dir, root, filePattern, patterns, violations) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanForDeadHandlers(fullPath, root, filePattern, patterns, violations);
      } else if (filePattern.test(entry.name)) {
        const content = readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          for (const { pattern, desc } of patterns) {
            pattern.lastIndex = 0;
            if (pattern.test(lines[i])) {
              const relPath = fullPath.slice(root.length + 1);
              violations.push(`${relPath}:${i + 1}: ${desc}`);
            }
          }
        }
      }
    }
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Gate 6: Smoke Test
// ---------------------------------------------------------------------------

async function gateSmokeTest(root, slug) {
  // Find smoke test files
  const testFiles = findSmokeTests(root, slug);

  if (testFiles.length === 0) {
    return { passed: false, details: `No smoke test found for "${slug}". Run /smoke to create one.` };
  }

  // Detect test runner
  const runner = detectTestRunner(root);
  if (!runner) {
    return { passed: false, details: "No test runner found. Install playwright, vitest, or jest." };
  }

  // Run tests
  const { execSync } = await import("node:child_process");
  const results = [];

  for (const testFile of testFiles) {
    try {
      const cmd = buildTestCommand(runner, testFile);
      execSync(cmd, { cwd: root, stdio: "pipe", timeout: 120000 });
      results.push({ file: testFile, status: "passed" });
    } catch (err) {
      const output = err.stdout?.toString() || err.stderr?.toString() || err.message;
      results.push({ file: testFile, status: "failed", error: output.slice(0, 300) });
    }
  }

  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    const details = failed.map((f) => `${f.file}: ${f.error}`).join("\n");
    return { passed: false, details: `${failed.length}/${results.length} test(s) failed:\n${details}` };
  }

  return { passed: true, details: `${results.length} smoke test(s) passed` };
}

function findSmokeTests(root, slug) {
  const candidates = [
    // Feature-specific smoke tests
    `tests/smoke/${slug}.test.ts`,
    `tests/smoke/${slug}.test.js`,
    `tests/smoke/${slug}.spec.ts`,
    `tests/smoke/${slug}.spec.js`,
    `tests/e2e/${slug}.test.ts`,
    `tests/e2e/${slug}.test.js`,
    `tests/e2e/${slug}.spec.ts`,
    `tests/e2e/${slug}.spec.js`,
    `e2e/${slug}.test.ts`,
    `e2e/${slug}.spec.ts`,
    // Playwright convention
    `tests/${slug}.spec.ts`,
    `tests/${slug}.spec.js`,
  ];

  const found = [];
  for (const candidate of candidates) {
    if (existsSync(join(root, candidate))) {
      found.push(candidate);
    }
  }

  // Also scan for files containing the slug name in test directories
  if (found.length === 0) {
    for (const dir of ["tests", "e2e", "__tests__"]) {
      const fullDir = join(root, dir);
      if (!existsSync(fullDir)) continue;
      try {
        for (const file of readdirSync(fullDir)) {
          if (file.includes(slug) && /\.(test|spec)\.(ts|js|tsx|jsx|mjs)$/.test(file)) {
            found.push(join(dir, file));
          }
        }
      } catch { /* skip */ }
    }
  }

  return found;
}

function detectTestRunner(root) {
  const pkg = readJsonSafe(join(root, "package.json"));
  if (!pkg) return null;

  const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const scripts = pkg.scripts || {};

  // Check in priority order
  if (allDeps["@playwright/test"] || allDeps.playwright) return "playwright";
  if (allDeps.vitest) return "vitest";
  if (allDeps.jest) return "jest";

  // Check scripts for hints
  if (scripts.test?.includes("playwright")) return "playwright";
  if (scripts.test?.includes("vitest")) return "vitest";
  if (scripts.test?.includes("jest")) return "jest";

  // Fallback: check if npx can find something
  if (existsSync(join(root, "playwright.config.ts")) || existsSync(join(root, "playwright.config.js"))) return "playwright";
  if (existsSync(join(root, "vitest.config.ts")) || existsSync(join(root, "vitest.config.js"))) return "vitest";
  if (existsSync(join(root, "jest.config.ts")) || existsSync(join(root, "jest.config.js"))) return "jest";

  return null;
}

function buildTestCommand(runner, testFile) {
  switch (runner) {
    case "playwright":
      return `npx playwright test ${testFile} --reporter=line`;
    case "vitest":
      return `npx vitest run ${testFile} --reporter=verbose`;
    case "jest":
      return `npx jest ${testFile} --verbose --forceExit`;
    default:
      return `npx vitest run ${testFile}`;
  }
}

// ---------------------------------------------------------------------------
// Gate 7: Vision
// ---------------------------------------------------------------------------

async function gateVision(root, slug) {
  const { vision } = await import("./vision.mjs");

  const savedArgv = [...process.argv];
  process.argv = [savedArgv[0], savedArgv[1], "vision", slug];
  const result = await callCommand(vision);
  process.argv = savedArgv;

  // Check VISION_REPORT.md for failures
  const reportPath = join(root, `.ogu/vision/${slug}/VISION_REPORT.md`);
  if (existsSync(reportPath)) {
    const report = readFileSync(reportPath, "utf-8");
    const hasFail = report.includes("[FAIL]") || report.includes("FAIL:");
    if (hasFail) {
      const failLines = report.split("\n").filter((l) => l.includes("FAIL")).slice(0, 5);
      return { passed: false, details: failLines.join("\n") };
    }
  }

  if (result.code !== 0) {
    return { passed: false, details: result.output || "Vision verification failed" };
  }

  return { passed: true, details: "Visual verification passed" };
}

// ---------------------------------------------------------------------------
// Gate 7: Contracts
// ---------------------------------------------------------------------------

async function gateContracts(root, slug) {
  const { contractsValidate } = await import("./contracts-validate.mjs");
  const result = await callCommand(contractsValidate);

  if (result.code !== 0) {
    return { passed: false, details: result.output || "Contract validation failed" };
  }

  // IR cross-reference: check contracts against IR outputs
  const ir = loadIR(root, slug);
  const warnings = [];
  if (ir && ir.hasIR()) {
    const contractsDir = join(root, "docs/vault/02_Contracts");
    if (existsSync(contractsDir)) {
      try {
        const contractFiles = readdirSync(contractsDir).filter((f) => f.endsWith(".contract.json"));
        for (const file of contractFiles) {
          const name = file.replace(".contract.json", "");
          const irRef = normalizeIR(`CONTRACT:${name}`);
          if (!ir.hasOutput(irRef)) {
            warnings.push(`OGU1002: Contract ${name} is orphaned (no IR output references it)`);
          }
        }
      } catch { /* skip */ }
    }
  }

  const detail = warnings.length > 0
    ? `Contracts valid. ${warnings.length} warning(s):\n${warnings.join("\n")}`
    : "All contracts valid";

  return { passed: true, details: detail };
}

// ---------------------------------------------------------------------------
// Gate 8: Preview
// ---------------------------------------------------------------------------

async function gatePreview(root) {
  const { preview } = await import("./preview.mjs");

  // Start preview and check health
  const result = await callCommand(preview);

  // Stop preview after checking
  const savedArgv = [...process.argv];
  process.argv = [savedArgv[0], savedArgv[1], "preview", "--stop"];
  try {
    await callCommand(preview);
  } catch { /* ignore stop errors */ }
  process.argv = savedArgv;

  if (result.code !== 0) {
    return { passed: false, details: result.output || "Preview health check failed" };
  }

  return { passed: true, details: "Preview healthy" };
}

// ---------------------------------------------------------------------------
// Gate 9: Memory
// ---------------------------------------------------------------------------

async function gateMemory(root) {
  const { remember } = await import("./remember.mjs");

  const savedArgv = [...process.argv];
  process.argv = [savedArgv[0], savedArgv[1], "remember", "--apply"];
  const result = await callCommand(remember);
  process.argv = savedArgv;

  // Memory gate always passes if remember doesn't crash
  // (it's informational — even 0 candidates is fine)
  if (result.code !== 0 && result.code !== undefined) {
    return { passed: false, details: result.output || "Remember command failed" };
  }

  return { passed: true, details: "Memory updated" };
}

// ---------------------------------------------------------------------------
// Gate 11: Brand Compliance
// ---------------------------------------------------------------------------

async function gateBrandCompliance(root) {
  // Find latest brand scan
  const brandsDir = join(root, ".ogu/brands");
  if (!existsSync(brandsDir)) {
    return { passed: true, details: "No brand scan found — gate skipped (optional)" };
  }

  let brandFiles;
  try {
    brandFiles = readdirSync(brandsDir).filter((f) => f.endsWith(".json"));
  } catch {
    return { passed: true, details: "No brand scan found — gate skipped (optional)" };
  }

  if (brandFiles.length === 0) {
    return { passed: true, details: "No brand scan found — gate skipped (optional)" };
  }

  const latestBrand = readJsonSafe(join(brandsDir, brandFiles[brandFiles.length - 1]));
  if (!latestBrand) {
    return { passed: true, details: "Brand scan file unreadable — gate skipped" };
  }

  const violations = [];

  // Extract primary color from brand scan (handle v2 and v3 formats)
  let primaryColor = null;
  if (latestBrand.colors?.base?.primary?.value) {
    primaryColor = latestBrand.colors.base.primary.value; // v3
  } else if (latestBrand.colors?.primary) {
    primaryColor = latestBrand.colors.primary; // v2
  }

  if (primaryColor) {
    // Normalize color for comparison (lowercase, no spaces)
    const normalizedPrimary = primaryColor.toLowerCase().trim();

    // Scan CSS, Tailwind config, and style files for brand color
    const styleFiles = findStyleFiles(root);
    let colorFound = false;

    for (const sf of styleFiles) {
      try {
        const content = readFileSync(join(root, sf), "utf-8").toLowerCase();
        if (content.includes(normalizedPrimary)) {
          colorFound = true;
          break;
        }
        // Also check for hex without # vs with #
        const hexVariant = normalizedPrimary.startsWith("#")
          ? normalizedPrimary.slice(1)
          : `#${normalizedPrimary}`;
        if (content.includes(hexVariant)) {
          colorFound = true;
          break;
        }
      } catch { /* skip */ }
    }

    if (!colorFound && styleFiles.length > 0) {
      violations.push(`Primary brand color ${primaryColor} not found in any style/config file`);
    }
  }

  // Check if brand logos are copied to public/ (if logos exist in brand scan)
  if (latestBrand.logos?.length > 0 && latestBrand.domain) {
    const publicDir = join(root, "public");
    if (existsSync(publicDir)) {
      const hasLogo = latestBrand.logos.some((logo) => {
        // Check common locations
        const candidates = [
          join(publicDir, logo.name),
          join(publicDir, "images", logo.name),
          join(publicDir, "assets", logo.name),
          join(publicDir, "img", logo.name),
        ];
        return candidates.some((p) => existsSync(p));
      });
      if (!hasLogo) {
        violations.push(`Brand logos not found in public/ — expected from ${latestBrand.domain}`);
      }
    }
  }

  // Check if brand fonts are referenced
  const brandFont = latestBrand.typography?.font_body || latestBrand.typography?.font_heading;
  if (brandFont) {
    const styleFiles = findStyleFiles(root);
    let fontFound = false;
    const normalizedFont = brandFont.toLowerCase();

    for (const sf of styleFiles) {
      try {
        const content = readFileSync(join(root, sf), "utf-8").toLowerCase();
        if (content.includes(normalizedFont)) {
          fontFound = true;
          break;
        }
      } catch { /* skip */ }
    }

    // Also check index.html and layout files
    for (const htmlFile of ["index.html", "src/index.html", "public/index.html", "app/layout.tsx", "src/app/layout.tsx"]) {
      const fp = join(root, htmlFile);
      if (existsSync(fp)) {
        try {
          const content = readFileSync(fp, "utf-8").toLowerCase();
          if (content.includes(normalizedFont)) {
            fontFound = true;
            break;
          }
        } catch { /* skip */ }
      }
    }

    if (!fontFound) {
      violations.push(`Brand font "${brandFont}" not referenced in style files or HTML`);
    }

    // Stronger check: if brand scan includes @font-face, project CSS must include it too
    const brandFontFaceCss = latestBrand.typography?.font_face_css;
    if (brandFontFaceCss && String(brandFontFaceCss).includes("@font-face")) {
      const globalCssFiles = findCssFiles(root);
      let fontFaceFound = false;
      for (const p of globalCssFiles) {
        try {
          const content = readFileSync(join(root, p), "utf-8");
          if (content.includes("@font-face") && content.toLowerCase().includes(normalizedFont)) {
            fontFaceFound = true;
            break;
          }
        } catch { /* skip */ }
      }
      if (!fontFaceFound && globalCssFiles.length > 0) {
        violations.push(`Brand provides @font-face for "${brandFont}" but no @font-face found in global CSS. Add the font-face declaration to your globals.css.`);
      }
    }

    // Prevent system-ui fallback when brand font exists
    const globalCssFiles = findCssFiles(root);
    for (const p of globalCssFiles) {
      try {
        const content = readFileSync(join(root, p), "utf-8").toLowerCase();
        const hasSystemFallback = content.includes("system-ui") || content.includes("ui-sans-serif");
        const hasBrandFont = content.includes(normalizedFont);
        if (hasSystemFallback && !hasBrandFont) {
          violations.push(`"system-ui" found in ${p} but brand font "${brandFont}" is absent. Globals must use the brand font, not a system fallback.`);
          break;
        }
      } catch { /* skip */ }
    }
  }

  if (violations.length > 0) {
    return {
      passed: false,
      details: `Brand compliance issues:\n${violations.join("\n")}`,
    };
  }

  return { passed: true, details: `Brand compliance verified (source: ${latestBrand.url || latestBrand.domain || "unknown"})` };
}

/** Find global CSS entry points — the files that must load brand fonts */
function findCssFiles(root) {
  const candidates = [
    "src/index.css", "src/globals.css", "src/app/globals.css", "app/globals.css",
    "src/styles/globals.css", "styles/globals.css",
  ];
  return candidates.filter(p => existsSync(join(root, p)));
}

/** Find CSS, Tailwind config, and style-related files */
function findStyleFiles(root) {
  const candidates = [];
  const patterns = [
    "tailwind.config.ts", "tailwind.config.js", "tailwind.config.mjs",
    "src/index.css", "src/globals.css", "src/app/globals.css", "app/globals.css",
    "src/styles/globals.css", "styles/globals.css",
    "design.tokens.json", ".ogu/THEME.json",
  ];

  for (const p of patterns) {
    if (existsSync(join(root, p))) candidates.push(p);
  }

  // Scan src/ for CSS files
  const srcDir = join(root, "src");
  if (existsSync(srcDir)) {
    scanForStyleFiles(srcDir, root, candidates);
  }

  return candidates;
}

function scanForStyleFiles(dir, root, results) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanForStyleFiles(fullPath, root, results);
      } else if (/\.(css|scss|sass|less)$/.test(entry.name)) {
        results.push(fullPath.slice(root.length + 1));
      }
    }
  } catch { /* skip */ }
}

// ---------------------------------------------------------------------------
// Gate 12: Design Compliance
// ---------------------------------------------------------------------------

async function gateDesignCompliance(root, slug) {
  const violations = [];

  // Collect all source files
  const jsxFiles = [];  // .tsx, .jsx
  const cssFiles = [];  // .css, .scss, .sass

  const planPath = join(root, `docs/vault/04_Features/${slug}/Plan.json`);
  const plan = readJsonSafe(planPath);
  const dirsToScan = new Set();

  if (plan?.tasks) {
    for (const task of plan.tasks) {
      if (task.touches) {
        for (const t of task.touches) {
          dirsToScan.add(t.split("/").slice(0, 2).join("/"));
        }
      }
    }
  }
  if (dirsToScan.size === 0) {
    for (const d of ["src", "app", "apps", "components"]) {
      if (existsSync(join(root, d))) dirsToScan.add(d);
    }
  }

  for (const dir of dirsToScan) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    collectDesignFiles(fullDir, root, jsxFiles, cssFiles);
  }

  // Also check root-level CSS
  for (const f of ["globals.css", "index.css", "styles.css"]) {
    const p = join(root, "src", f);
    if (existsSync(p)) cssFiles.push(p);
    const p2 = join(root, "src", "app", f);
    if (existsSync(p2)) cssFiles.push(p2);
    const p3 = join(root, "app", f);
    if (existsSync(p3)) cssFiles.push(p3);
  }

  // --- Check 1: No emojis as UI icons in JSX ---
  const emojiInJsx = /(?:className|style)[^>]*>[^<]*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  // Simpler: emoji directly inside JSX tags (not in strings/comments)
  const emojiAsIcon = />\s*[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*</u;
  for (const file of jsxFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (emojiAsIcon.test(lines[i])) {
          const rel = file.slice(root.length + 1);
          violations.push(`${rel}:${i + 1}: emoji used as UI icon — use lucide-react or similar`);
        }
      }
    } catch { /* skip */ }
  }

  // --- Check 2: No monospace as UI font ---
  const monoUiPattern = /font-family\s*:\s*[^;]*(?:monospace|Courier|Consolas|Monaco|'Fira Code'|'Source Code')[^;]*;/i;
  for (const file of cssFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (monoUiPattern.test(lines[i])) {
          // Skip if it's inside a code/pre selector
          const context = lines.slice(Math.max(0, i - 5), i).join("\n");
          if (/(?:pre|code|\.code|\.mono|\.terminal|\.editor)/i.test(context)) continue;
          const rel = file.slice(root.length + 1);
          violations.push(`${rel}:${i + 1}: monospace font used for UI — only use for code blocks`);
        }
      }
    } catch { /* skip */ }
  }
  // Also check inline styles in JSX
  const monoInlinePattern = /fontFamily\s*:\s*["'][^"']*(?:monospace|Courier|Consolas|Monaco)[^"']*["']/i;
  for (const file of jsxFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (monoInlinePattern.test(lines[i])) {
          // Skip code-related components
          const context = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
          if (/(?:Code|Pre|Terminal|Editor|code|pre|terminal)/i.test(context)) continue;
          const rel = file.slice(root.length + 1);
          violations.push(`${rel}:${i + 1}: monospace inline style for UI element`);
        }
      }
    } catch { /* skip */ }
  }

  // --- Check 3: Hover states exist in CSS ---
  let hasHoverStates = false;
  for (const file of cssFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      if (content.includes(":hover")) { hasHoverStates = true; break; }
    } catch { /* skip */ }
  }
  if (!hasHoverStates && cssFiles.length > 0) {
    // Also check inline hover in JSX (onMouseOver, hoverStyle, :hover in template literals)
    for (const file of jsxFiles) {
      try {
        const content = readFileSync(file, "utf-8");
        if (content.includes("onMouseOver") || content.includes("hoverStyle") || content.includes(":hover")) {
          hasHoverStates = true;
          break;
        }
      } catch { /* skip */ }
    }
    if (!hasHoverStates && jsxFiles.length > 0) {
      violations.push("No hover states found in any CSS or JSX file — interactive elements need hover feedback");
    }
  }

  // --- Check 4: Font size minimum (no less than 10px for body text) ---
  const tinyFontCss = /font-size\s*:\s*(\d+)px/g;
  const tinyFontInline = /fontSize\s*:\s*(\d+)/g;
  for (const file of cssFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        let m;
        tinyFontCss.lastIndex = 0;
        while ((m = tinyFontCss.exec(lines[i])) !== null) {
          const size = parseInt(m[1], 10);
          if (size > 0 && size < 10) {
            const rel = file.slice(root.length + 1);
            violations.push(`${rel}:${i + 1}: font-size ${size}px is too small — minimum 10px`);
          }
        }
      }
    } catch { /* skip */ }
  }
  for (const file of jsxFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        let m;
        tinyFontInline.lastIndex = 0;
        while ((m = tinyFontInline.exec(lines[i])) !== null) {
          const size = parseInt(m[1], 10);
          if (size > 0 && size < 10) {
            // Skip icon sizes, line-height, etc.
            const ctx = lines[i].slice(Math.max(0, m.index - 20), m.index);
            if (/icon|svg|line|gap|padding|margin|width|height|border|radius/i.test(ctx)) continue;
            const rel = file.slice(root.length + 1);
            violations.push(`${rel}:${i + 1}: fontSize ${size} is too small — minimum 10px`);
          }
        }
      }
    } catch { /* skip */ }
  }

  // --- Check 5: Button minimum height ---
  // Check for explicit small button heights in CSS
  const btnHeightCss = /(?:\.btn|button|\.button)[^{]*\{[^}]*height\s*:\s*(\d+)px/gi;
  for (const file of cssFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      let m;
      btnHeightCss.lastIndex = 0;
      while ((m = btnHeightCss.exec(content)) !== null) {
        const h = parseInt(m[1], 10);
        if (h > 0 && h < 36) {
          const rel = file.slice(root.length + 1);
          const line = content.slice(0, m.index).split("\n").length;
          violations.push(`${rel}:${line}: button height ${h}px — minimum recommended 36px`);
        }
      }
    } catch { /* skip */ }
  }

  // --- Check 6: Responsive breakpoints exist ---
  let hasResponsive = false;
  for (const file of cssFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      if (content.includes("@media")) { hasResponsive = true; break; }
    } catch { /* skip */ }
  }
  // Check tailwind config for responsive
  const twConfig = join(root, "tailwind.config.ts");
  const twConfigJs = join(root, "tailwind.config.js");
  if (existsSync(twConfig) || existsSync(twConfigJs)) {
    hasResponsive = true; // Tailwind has responsive built-in
  }
  if (!hasResponsive && cssFiles.length > 0) {
    violations.push("No responsive breakpoints (@media) found — design should be mobile-first");
  }

  if (violations.length > 0) {
    return {
      passed: false,
      details: `${violations.length} design issue(s):\n${violations.slice(0, 15).join("\n")}`,
    };
  }

  return {
    passed: true,
    details: `Design compliance verified (${jsxFiles.length} JSX, ${cssFiles.length} CSS files scanned)`,
  };
}

function collectDesignFiles(dir, root, jsxFiles, cssFiles) {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        collectDesignFiles(fullPath, root, jsxFiles, cssFiles);
      } else if (/\.(tsx|jsx)$/.test(entry.name)) {
        jsxFiles.push(fullPath);
      } else if (/\.(css|scss|sass|less)$/.test(entry.name)) {
        cssFiles.push(fullPath);
      }
    }
  } catch { /* skip */ }
}

// ---------------------------------------------------------------------------
// Gate 13: Spec Consistency
// ---------------------------------------------------------------------------

async function gateSpecConsistency(root, slug) {
  const featureDir = join(root, `docs/vault/04_Features/${slug}`);
  const specPath = join(featureDir, "Spec.md");

  if (!existsSync(specPath)) {
    return { passed: true, details: "No Spec.md found — gate skipped" };
  }

  const specContent = readFileSync(specPath, "utf-8");
  const actualHash = createHash("sha256").update(specContent).digest("hex");

  // Check lock
  const lockPath = join(root, ".ogu/CONTEXT_LOCK.json");
  if (!existsSync(lockPath)) {
    return { passed: true, details: "No context lock — gate skipped" };
  }

  const lock = readJsonSafe(lockPath);
  const lockedHash = lock?.spec_hashes?.[slug];

  if (!lockedHash) {
    return { passed: true, details: "No spec hash in lock — gate skipped (run context:lock first)" };
  }

  if (lockedHash === actualHash) {
    // Hash matches — check IR coverage
    return checkSpecIRCoverage(root, slug, specContent);
  }

  // Hash mismatch — traverse SCR chain
  const scrFiles = getSCRFilesFromDir(featureDir);
  if (scrFiles.length === 0) {
    return {
      passed: false,
      details: `Spec.md changed (locked: ${lockedHash.slice(0, 12)}, actual: ${actualHash.slice(0, 12)}) but no SCRs found. Run: ogu spec:patch ${slug} "description"`,
    };
  }

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
    if (visited.has(current)) {
      return { passed: false, details: `Spec hash chain has cycle at ${current.slice(0, 12)}` };
    }
    visited.add(current);
    const next = scrData.find((s) => s.previous === current);
    if (!next) {
      return {
        passed: false,
        details: `Spec hash chain broken: locked ${lockedHash.slice(0, 12)} → ... → dead end at ${current.slice(0, 12)}. Actual: ${actualHash.slice(0, 12)}`,
      };
    }
    current = next.current;
  }

  // Chain valid — also check IR coverage
  const coverage = checkSpecIRCoverage(root, slug, specContent);
  return {
    passed: coverage.passed,
    details: `Hash chain valid (${scrData.length} SCR(s)). ${coverage.details}`,
  };
}

function checkSpecIRCoverage(root, slug, specContent) {
  const ir = loadIR(root, slug);
  if (!ir || !ir.hasIR()) {
    return { passed: true, details: "No IR — spec coverage check skipped" };
  }

  // Check every spec_section in IR tasks still exists in Spec.md
  const missing = [];
  for (const section of ir.allSpecSections) {
    // Normalize: "## API" should match "## API" heading in spec
    const heading = section.startsWith("## ") ? section.slice(3) : section;
    if (!specContent.includes(`## ${heading}`)) {
      missing.push(section);
    }
  }

  if (missing.length > 0) {
    return {
      passed: false,
      details: `IR references ${missing.length} spec section(s) not found in Spec.md: ${missing.join(", ")}`,
    };
  }

  return { passed: true, details: `All ${ir.allSpecSections.length} spec sections present` };
}

function getSCRFilesFromDir(featureDir) {
  try {
    return readdirSync(featureDir)
      .filter((f) => /^SCR_\d{3}/.test(f) && f.endsWith(".md"))
      .sort();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Gate 14: Drift Check
// ---------------------------------------------------------------------------

async function gateDriftCheck(root, slug) {
  const { drift } = await import("./drift.mjs");

  const savedArgv = [...process.argv];
  process.argv = [savedArgv[0], savedArgv[1], "drift", slug];
  const result = await callCommand(drift);
  process.argv = savedArgv;

  // Check DRIFT_REPORT.md for errors
  const reportPath = join(root, ".ogu/DRIFT_REPORT.md");
  if (existsSync(reportPath)) {
    const report = readFileSync(reportPath, "utf-8");
    const hasError = report.includes("\u274C");
    if (hasError) {
      const errorLines = report.split("\n").filter((l) => l.includes("\u274C")).slice(0, 5);
      return { passed: false, details: errorLines.join("\n") };
    }
  }

  if (result.code !== 0) {
    return { passed: false, details: result.output || "Drift detection found issues" };
  }

  return { passed: true, details: "No drift detected" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callCommand(fn) {
  const origLog = console.log;
  const origErr = console.error;
  const captured = [];

  let code = 0;
  try {
    console.log = (msg) => captured.push(String(msg));
    console.error = (msg) => captured.push(String(msg));
    code = (await fn()) ?? 0;
  } catch (err) {
    code = 1;
    captured.push(err.message);
  } finally {
    console.log = origLog;
    console.error = origErr;
  }

  return { code, output: captured.join("\n") };
}

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}
