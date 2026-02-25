import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, readJsonSafe } from "../util.mjs";
import { hashFile } from "./context-lock.mjs";

const REQUIRED_DIRS = [
  "docs/vault",
  "docs/vault/01_Architecture",
  "docs/vault/02_Contracts",
  "docs/vault/03_ADRs",
  "docs/vault/04_Features",
  "docs/vault/05_Runbooks",
  ".ogu",
  ".ogu/memory",
];

const REQUIRED_FILES = [
  "docs/vault/00_Index.md",
  "docs/vault/01_Architecture/Repo_Map.md",
  "docs/vault/01_Architecture/Module_Boundaries.md",
  "docs/vault/01_Architecture/Invariants.md",
  "docs/vault/01_Architecture/Patterns.md",
  "docs/vault/02_Contracts/API_Contracts.md",
  "docs/vault/02_Contracts/Navigation_Contract.md",
  "docs/vault/02_Contracts/SDUI_Schema.md",
  "docs/vault/03_ADRs/ADR_0001_template.md",
  "docs/vault/04_Features/README.md",
  "docs/vault/05_Runbooks/Dev_Setup.md",
  "docs/vault/05_Runbooks/Release_Process.md",
  ".ogu/SOUL.md",
  ".ogu/USER.md",
  ".ogu/IDENTITY.md",
  ".ogu/MEMORY.md",
  ".ogu/SESSION.md",
  ".ogu/STATE.json",
  ".ogu/CONTEXT.md",
  ".ogu/memory/.gitkeep",
];

const STATE_SCHEMA = {
  version: "number",
  current_task: "string|null",
  last_context_build: "string|null",
  last_repo_map_update: "string|null",
  recent_adrs: "array",
  notes: "string",
};

export async function validate() {
  const root = repoRoot();
  const errors = [];

  // Check required directories
  for (const dir of REQUIRED_DIRS) {
    if (!existsSync(join(root, dir))) {
      errors.push(`Missing directory: ${dir}`);
    }
  }

  // Check required files
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing file: ${file}`);
    }
  }

  // Validate STATE.json
  const statePath = join(root, ".ogu/STATE.json");
  if (existsSync(statePath)) {
    try {
      const raw = readFileSync(statePath, "utf-8");
      const state = JSON.parse(raw);
      validateStateSchema(state, errors);
    } catch (e) {
      if (e instanceof SyntaxError) {
        errors.push(`Invalid JSON in .ogu/STATE.json: ${e.message}`);
      } else {
        throw e;
      }
    }
  }

  // Validate Invariants.md has real rules
  const invariantsPath = join(root, "docs/vault/01_Architecture/Invariants.md");
  if (existsSync(invariantsPath)) {
    validateInvariants(invariantsPath, errors);
  }

  // Validate CONTEXT_LOCK.json if it exists
  const lockPath = join(root, ".ogu/CONTEXT_LOCK.json");
  if (existsSync(lockPath)) {
    validateContextLock(root, lockPath, errors);
  }

  // Validate .contract.json files if present
  validateContractSchemas(root, errors);

  // Print results
  console.log("");
  if (errors.length === 0) {
    console.log("Ogu validate: OK");
    return 0;
  }

  for (const err of errors) {
    console.log(`  ERROR  ${err}`);
  }
  console.log("");
  console.log(`Ogu validate: FAILED (${errors.length} error${errors.length > 1 ? "s" : ""})`);
  return 1;
}

function validateStateSchema(state, errors) {
  for (const [key, expectedType] of Object.entries(STATE_SCHEMA)) {
    if (!(key in state)) {
      errors.push(`STATE.json missing required field: "${key}"`);
      continue;
    }
    const val = state[key];
    if (expectedType === "array") {
      if (!Array.isArray(val)) {
        errors.push(`STATE.json field "${key}" must be an array, got ${typeof val}`);
      }
    } else if (expectedType === "string|null") {
      if (val !== null && typeof val !== "string") {
        errors.push(`STATE.json field "${key}" must be string or null, got ${typeof val}`);
      }
    } else if (typeof val !== expectedType) {
      errors.push(`STATE.json field "${key}" must be ${expectedType}, got ${typeof val}`);
    }
  }
}

function validateInvariants(filePath, errors) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Find the "## Rules" section
  let inRulesSection = false;
  let ruleCount = 0;

  for (const line of lines) {
    if (/^## Rules/i.test(line)) {
      inRulesSection = true;
      continue;
    }
    if (inRulesSection && /^## /.test(line)) {
      break; // Next section
    }
    if (inRulesSection) {
      const trimmed = line.trim();
      // Count non-empty bullet lines that aren't HTML comments or TODO markers
      if (
        trimmed.startsWith("- ") &&
        !trimmed.includes("TODO") &&
        !trimmed.includes("<!--") &&
        trimmed.length > 3
      ) {
        ruleCount++;
      }
    }
  }

  if (!inRulesSection) {
    errors.push('Invariants.md is missing a "## Rules" section');
  } else if (ruleCount < 5) {
    errors.push(
      `Invariants.md has only ${ruleCount} rule(s) under "## Rules" (need at least 5). Replace TODO examples with real invariants.`
    );
  }
}

const LOCK_CHECKS = [
  ["context_hash", ".ogu/CONTEXT.md"],
  ["state_hash", ".ogu/STATE.json"],
  ["repo_map_hash", "docs/vault/01_Architecture/Repo_Map.md"],
];

function validateContextLock(root, lockPath, errors) {
  let lock;
  try {
    lock = JSON.parse(readFileSync(lockPath, "utf-8"));
  } catch {
    errors.push("CONTEXT_LOCK.json is not valid JSON");
    return;
  }

  for (const [key, relPath] of LOCK_CHECKS) {
    if (!lock[key]) {
      errors.push(`CONTEXT_LOCK.json missing field: "${key}"`);
      continue;
    }
    const current = hashFile(root, relPath);
    if (!current) {
      errors.push(`Lock references ${relPath} but file is missing`);
    } else if (current !== lock[key]) {
      errors.push(`Lock mismatch: ${relPath} has changed since last lock. Run \`ogu context:lock\` to update.`);
    }
  }
}

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function validateContractSchemas(root, errors) {
  const contractsDir = join(root, "docs/vault/02_Contracts");
  if (!existsSync(contractsDir)) return;

  let files;
  try {
    files = readdirSync(contractsDir).filter((f) => f.endsWith(".contract.json") || f === "design.tokens.json");
  } catch {
    return;
  }

  for (const file of files) {
    const relPath = `docs/vault/02_Contracts/${file}`;
    const contract = readJsonSafe(join(root, relPath));
    if (!contract) {
      errors.push(`${relPath} is not valid JSON`);
      continue;
    }
    if (!contract.version) {
      errors.push(`${relPath} missing required field: "version"`);
    } else if (!SEMVER_RE.test(contract.version)) {
      errors.push(`${relPath} version "${contract.version}" is not valid semver (expected X.Y.Z)`);
    }
    if (!contract.last_updated) {
      errors.push(`${relPath} missing required field: "last_updated"`);
    }
  }
}
