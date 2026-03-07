import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { validate } from "./validate.mjs";
import { repoMap } from "./repo-map.mjs";
import { context } from "./context.mjs";
import { log } from "./log.mjs";
import { remember } from "./remember.mjs";
import { contextLock } from "./context-lock.mjs";
import { repoRoot } from "../util.mjs";
import { createAuditChain } from "./lib/audit-trail-integrity.mjs";
import { validateConfig, OGU_SCHEMAS } from "./lib/config-schema.mjs";

const EXIT_CODES = {
  validate: 11,
  "repo-map": 12,
  context: 13,
  "context:lock": 16,
  log: 14,
  remember: 15,
};

const HINTS = {
  validate: "Run: ogu init",
  "repo-map": "Check repo permissions and paths",
  context: "Ensure required vault files exist",
  "context:lock": "Ensure CONTEXT.md, STATE.json, and Repo_Map.md exist",
  log: "Check .ogu/memory/ directory exists and is writable",
  remember: "Check .ogu/SESSION.md and daily logs exist",
};

const STRICT_FILES = [
  "docs/vault/02_Contracts/API_Contracts.md",
  "docs/vault/02_Contracts/Navigation_Contract.md",
  "docs/vault/02_Contracts/Design_System_Contract.md",
  "docs/vault/01_Architecture/Patterns.md",
];

export async function doctor() {
  const args = process.argv.slice(3);
  const strict = args.includes("--strict");
  const reportPath = parseFlag(args, "--report");
  const root = repoRoot();

  const steps = [
    { name: "validate",     exitCode: EXIT_CODES.validate,        fn: () => validate() },
    { name: "repo-map",     exitCode: EXIT_CODES["repo-map"],     fn: () => repoMap() },
    { name: "context",      exitCode: EXIT_CODES.context,         fn: () => context(["--feature", "doctor", "--issue", "health check"]) },
    { name: "context:lock", exitCode: EXIT_CODES["context:lock"], fn: () => contextLock() },
    { name: "log",          exitCode: EXIT_CODES.log,             fn: () => log("Ogu doctor health check executed") },
    { name: "remember",     exitCode: EXIT_CODES.remember,        fn: () => remember() },
    { name: "validate",     exitCode: EXIT_CODES.validate,        fn: () => validate() },
  ];

  const origLog = console.log;
  const origErr = console.error;
  const total = steps.length;
  const results = [];
  let firstFailure = null;

  for (let i = 0; i < total; i++) {
    const step = steps[i];
    const label = `[${i + 1}/${total}] ${step.name}`;
    const dots = ".".repeat(Math.max(1, 20 - step.name.length));

    let code = 0;
    let errorMsg = "";
    const captured = [];

    try {
      console.log = (msg) => captured.push(String(msg));
      console.error = (msg) => captured.push(String(msg));
      code = (await step.fn()) ?? 0;
    } catch (err) {
      code = 1;
      errorMsg = err.message || "Unknown error";
    } finally {
      console.log = origLog;
      console.error = origErr;
    }

    // Extract error messages from captured output
    if (code !== 0 && !errorMsg) {
      const errLines = captured.filter((l) => l.includes("ERROR") || l.includes("FAILED"));
      errorMsg = errLines.slice(0, 10).join("\n") || "Step returned non-zero exit code";
    }

    const status = code === 0 ? "OK" : "FAILED";
    results.push({ index: i + 1, name: step.name, status, errorMsg, exitCode: step.exitCode });

    origLog(`${label} ${dots} ${status}`);

    if (code !== 0) {
      if (!firstFailure) firstFailure = results[results.length - 1];
      origLog(`         Error: ${errorMsg.split("\n")[0]}`);
      origLog(`         Next action: ${HINTS[step.name]}`);
    }
  }

  // Strict checks
  let strictErrors = [];
  if (strict) {
    strictErrors = runStrictChecks(root);
    if (strictErrors.length > 0) {
      origLog("");
      origLog("[strict] Additional checks:");
      for (const e of strictErrors) {
        origLog(`  FAIL  ${e}`);
      }
    }
  }

  const healthy = !firstFailure && strictErrors.length === 0;

  origLog("");
  if (healthy) {
    origLog(`Ogu doctor: HEALTHY${strict ? " (strict)" : ""}`);
  } else {
    const failCount = results.filter((r) => r.status === "FAILED").length + strictErrors.length;
    origLog(`Ogu doctor: FAILED (${failCount} issue${failCount > 1 ? "s" : ""})`);
  }

  // Write report
  const report = buildReport(root, results, strictErrors, healthy, strict);
  const outPath = reportPath || join(root, ".ogu/DOCTOR.md");
  writeFileSync(outPath, report, "utf-8");
  origLog(`  report   ${outPath.startsWith(root) ? outPath.slice(root.length + 1) : outPath}`);

  if (!healthy) {
    // Use the first failure's exit code
    if (firstFailure) return firstFailure.exitCode;
    return 11; // strict failure defaults to validate code
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Strict checks
// ---------------------------------------------------------------------------

function runStrictChecks(root) {
  const errors = [];

  for (const relPath of STRICT_FILES) {
    const full = join(root, relPath);
    if (!existsSync(full)) continue;
    const content = readFileSync(full, "utf-8");
    if (content.includes("TODO")) {
      errors.push(`${relPath} contains TODO markers`);
    }
  }

  // Repo_Map.md must have >= 15 non-empty lines
  const repoMapPath = join(root, "docs/vault/01_Architecture/Repo_Map.md");
  if (existsSync(repoMapPath)) {
    const lines = readFileSync(repoMapPath, "utf-8")
      .split("\n")
      .filter((l) => l.trim().length > 0);
    if (lines.length < 15) {
      errors.push(`Repo_Map.md has only ${lines.length} non-empty lines (need at least 15)`);
    }
  }

  // Audit trail integrity check (Phase 3C)
  try {
    const auditFile = join(root, ".ogu/audit/current.jsonl");
    if (existsSync(auditFile)) {
      const lines = readFileSync(auditFile, "utf-8").trim().split("\n").filter(Boolean);
      const chain = createAuditChain();
      let chainValid = true;
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          chain.append(event);
        } catch { /* skip malformed lines */ }
      }
      chainValid = chain.verify();
      if (!chainValid) {
        errors.push("Audit trail integrity check failed — chain hash mismatch");
      }
    }
  } catch { /* best-effort */ }

  // Config schema check: STATE.json (Phase 3E)
  try {
    const statePath = join(root, ".ogu/STATE.json");
    if (existsSync(statePath)) {
      const state = JSON.parse(readFileSync(statePath, "utf-8"));
      const { valid, errors: schemaErrors } = validateConfig(state, OGU_SCHEMAS.STATE);
      if (!valid) {
        for (const e of schemaErrors) {
          errors.push(`STATE.json schema error: ${e}`);
        }
      }
    }
  } catch { /* best-effort */ }

  return errors;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function buildReport(root, results, strictErrors, healthy, strict) {
  const now = new Date().toISOString();
  const repoName = getRepoName(root);

  let md = `# Ogu Doctor Report\n`;
  md += `Built: ${now}\n`;
  md += `Repo: ${repoName}\n`;
  if (strict) md += `Mode: strict\n`;

  md += `\n## Result\n${healthy ? "HEALTHY" : "FAILED"}\n`;

  md += `\n## Steps\n`;
  for (const r of results) {
    md += `- [${r.index}/${results.length}] ${r.name}: ${r.status}\n`;
  }

  if (strict && strictErrors.length > 0) {
    md += `\n## Strict Checks\n`;
    for (const e of strictErrors) {
      md += `- FAIL: ${e}\n`;
    }
  }

  md += `\n## Artifacts\n`;
  const artifacts = [
    ["CONTEXT", ".ogu/CONTEXT.md"],
    ["STATE", ".ogu/STATE.json"],
    ["LAST LOG", getLatestLog(root)],
    ["MEMORY PROPOSAL", ".ogu/MEMORY_PROPOSAL.md"],
    ["REPO MAP", "docs/vault/01_Architecture/Repo_Map.md"],
  ];
  for (const [label, relPath] of artifacts) {
    const exists = relPath && existsSync(join(root, relPath));
    md += `- ${label}: ${relPath || "(none)"} (exists: ${exists ? "yes" : "no"})\n`;
  }

  if (!healthy) {
    const failure = results.find((r) => r.status === "FAILED");
    if (failure) {
      md += `\n## Failure\n`;
      md += `Step: ${failure.name}\n`;
      md += `Error: ${truncate(failure.errorMsg, 10)}\n`;
      md += `Next action: ${HINTS[failure.name]}\n`;
    }
    if (strictErrors.length > 0 && !failure) {
      md += `\n## Failure\n`;
      md += `Step: strict checks\n`;
      md += `Error: ${strictErrors[0]}\n`;
      md += `Next action: Fill in vault documents and remove TODO markers\n`;
    }
  }

  return md;
}

function getRepoName(root) {
  // Try git remote
  try {
    const configPath = join(root, ".git/config");
    if (existsSync(configPath)) {
      const config = readFileSync(configPath, "utf-8");
      const match = config.match(/url\s*=\s*(.+)/);
      if (match) return match[1].trim();
    }
  } catch { /* ignore */ }
  return basename(root);
}

function getLatestLog(root) {
  const memDir = join(root, ".ogu/memory");
  if (!existsSync(memDir)) return null;
  const logs = readdirSync(memDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse();
  return logs.length > 0 ? `.ogu/memory/${logs[0]}` : null;
}

function truncate(text, maxLines) {
  if (!text) return "(no details)";
  const lines = text.split("\n").slice(0, maxLines);
  return lines.join("\n");
}

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}
