import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { repoRoot, readJsonSafe, deepDiff } from "../util.mjs";
import { hashFile } from "./context-lock.mjs";

const CONTRACTS_DIR = "docs/vault/02_Contracts";

export async function contractMigrate() {
  const root = repoRoot();
  const contractsDir = join(root, CONTRACTS_DIR);

  if (!existsSync(contractsDir)) {
    console.error(`  ERROR  Contracts directory not found: ${CONTRACTS_DIR}`);
    return 1;
  }

  // Load lock file for comparison baseline
  const lockPath = join(root, ".ogu/CONTEXT_LOCK.json");
  const lock = readJsonSafe(lockPath);

  // Find all .contract.json files
  const contractFiles = readdirSync(contractsDir)
    .filter((f) => f.endsWith(".contract.json"))
    .map((f) => join(contractsDir, f));

  if (contractFiles.length === 0) {
    console.error("  ERROR  No .contract.json files found.");
    return 1;
  }

  const report = {
    timestamp: new Date().toISOString(),
    contracts: [],
    total_breaking: 0,
    total_non_breaking: 0,
  };

  for (const file of contractFiles) {
    const relPath = file.startsWith(root) ? file.slice(root.length + 1) : file;
    const current = readJsonSafe(file);
    if (!current) {
      console.log(`  skip     ${relPath} (invalid JSON)`);
      continue;
    }

    // Check if this contract has changed since lock
    const currentHash = hashFile(root, relPath);
    const lockedHash = lock ? lock[`contract_${relPath.replace(/[/.]/g, "_")}`] : null;
    const hasChanged = !lockedHash || currentHash !== lockedHash;

    if (!hasChanged) {
      console.log(`  stable   ${relPath} (matches lock)`);
      continue;
    }

    // Get locked version from changelog
    const lockedVersion = getLockedVersion(current, lock);
    const lockedState = reconstructFromChangelog(current, lockedVersion);

    if (!lockedState) {
      // No baseline — treat entire contract as new
      const contractReport = analyzeNewContract(relPath, current);
      report.contracts.push(contractReport);
      report.total_non_breaking += contractReport.non_breaking.length;
      console.log(`  new      ${relPath} v${current.version} (${contractReport.non_breaking.length} items)`);
      continue;
    }

    // Diff against locked state
    const diff = deepDiff(lockedState, current);
    const breaking = classifyBreaking(diff);
    const nonBreaking = classifyNonBreaking(diff);

    const contractReport = {
      file: relPath,
      version_from: lockedVersion || "unknown",
      version_to: current.version,
      breaking,
      non_breaking: nonBreaking,
      impact: assessImpact(relPath, breaking, root),
    };

    report.contracts.push(contractReport);
    report.total_breaking += breaking.length;
    report.total_non_breaking += nonBreaking.length;

    const status = breaking.length > 0 ? "BREAKING" : "changed";
    console.log(`  ${status.padEnd(8)} ${relPath}  ${contractReport.version_from} → ${contractReport.version_to}`);

    if (breaking.length > 0) {
      for (const b of breaking) {
        console.log(`           ⚠ ${b.description}`);
      }
    }
  }

  // Summary
  console.log("");
  if (report.total_breaking > 0) {
    console.log(`  Migration: ${report.total_breaking} BREAKING, ${report.total_non_breaking} non-breaking changes`);
    console.log("  Action required: Update implementation to match new contracts.");
  } else if (report.total_non_breaking > 0) {
    console.log(`  Migration: ${report.total_non_breaking} non-breaking changes`);
    console.log("  Safe to proceed. New features available in contracts.");
  } else {
    console.log("  Migration: No changes detected.");
  }

  return report.total_breaking > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------------

function getLockedVersion(contract, lock) {
  if (!lock || !lock.timestamp) return null;
  // Find the changelog entry closest to lock timestamp
  if (!contract.changelog || contract.changelog.length < 2) return null;
  return contract.changelog[contract.changelog.length - 1]?.version || null;
}

function reconstructFromChangelog(contract, version) {
  // Simple heuristic: if we have multiple changelog entries, the previous state
  // is approximated. For accurate diffing, use contract:diff with git history.
  // Here we just compare structural elements.
  if (!version) return null;
  return null; // Fall through to git-based diff in contract:diff
}

function analyzeNewContract(relPath, contract) {
  const items = [];
  if (contract.endpoints) {
    for (const ep of contract.endpoints) {
      items.push({ type: "endpoint", description: `${ep.method} ${ep.path}` });
    }
  }
  if (contract.routes) {
    for (const route of flattenRoutes(contract.routes)) {
      items.push({ type: "route", description: route.path });
    }
  }
  if (contract.models) {
    for (const name of Object.keys(contract.models)) {
      items.push({ type: "model", description: name });
    }
  }
  return { file: relPath, version_from: "none", version_to: contract.version, breaking: [], non_breaking: items, impact: [] };
}

function flattenRoutes(routes, acc = []) {
  for (const route of routes) {
    acc.push(route);
    if (route.children) flattenRoutes(route.children, acc);
  }
  return acc;
}

function classifyBreaking(diff) {
  const breaking = [];
  for (const item of diff.removed) {
    breaking.push({
      type: "removed",
      path: item.path,
      description: `Removed: ${item.path} (was: ${item.value})`,
    });
  }
  for (const item of diff.changed) {
    if (isBreaking(item.path)) {
      breaking.push({
        type: "changed",
        path: item.path,
        description: `Changed: ${item.path} from ${item.from} to ${item.to}`,
      });
    }
  }
  return breaking;
}

function classifyNonBreaking(diff) {
  const nonBreaking = [];
  for (const item of diff.added) {
    nonBreaking.push({
      type: "added",
      path: item.path,
      description: `Added: ${item.path} (${item.value})`,
    });
  }
  for (const item of diff.changed) {
    if (!isBreaking(item.path)) {
      nonBreaking.push({
        type: "changed",
        path: item.path,
        description: `Changed: ${item.path} from ${item.from} to ${item.to}`,
      });
    }
  }
  return nonBreaking;
}

function isBreaking(path) {
  if (path.includes(".type")) return true;
  if (path.includes(".required")) return true;
  if (path.match(/endpoints\[\d+\]\.(path|method)$/)) return true;
  if (path.match(/routes\[\d+\]\.path$/)) return true;
  return false;
}

function assessImpact(contractFile, breakingChanges, root) {
  const impact = [];
  for (const b of breakingChanges) {
    if (b.path.includes("endpoints")) {
      impact.push({
        area: "API implementation",
        description: `API handler may need update: ${b.description}`,
      });
    }
    if (b.path.includes("routes")) {
      impact.push({
        area: "Navigation",
        description: `Route configuration may need update: ${b.description}`,
      });
    }
    if (b.path.includes("models")) {
      impact.push({
        area: "Data model",
        description: `Type definitions may need update: ${b.description}`,
      });
    }
  }
  return impact;
}
