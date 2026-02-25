import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import { repoRoot, readJsonSafe, deepDiff } from "../util.mjs";

const CONTRACTS_DIR = "docs/vault/02_Contracts";

export async function contractDiff() {
  const args = process.argv.slice(3);
  const version = parseFlag(args, "--version");
  const target = args.find((a) => !a.startsWith("--") && a !== version);

  const root = repoRoot();
  const contractsDir = join(root, CONTRACTS_DIR);

  // Find target files
  let files;
  if (target) {
    const full = target.startsWith("/") ? target : join(root, target);
    if (!existsSync(full)) {
      console.error(`  ERROR  File not found: ${target}`);
      return 1;
    }
    files = [full];
  } else {
    if (!existsSync(contractsDir)) {
      console.error(`  ERROR  Contracts directory not found: ${CONTRACTS_DIR}`);
      return 1;
    }
    files = readdirSync(contractsDir)
      .filter((f) => f.endsWith(".contract.json"))
      .map((f) => join(contractsDir, f));
  }

  if (files.length === 0) {
    console.error("  ERROR  No .contract.json files found.");
    return 1;
  }

  let hasChanges = false;

  for (const file of files) {
    const relPath = file.startsWith(root) ? file.slice(root.length + 1) : file;
    const current = readJsonSafe(file);
    if (!current) {
      console.log(`  skip     ${relPath} (invalid JSON)`);
      continue;
    }

    // Get previous version from git
    const previous = getPreviousVersion(root, relPath, version);
    if (!previous) {
      console.log(`\n## ${relPath}`);
      console.log("  No previous version found in git history.");
      continue;
    }

    const diff = deepDiff(previous, current);
    const totalChanges = diff.added.length + diff.removed.length + diff.changed.length;

    if (totalChanges === 0) {
      console.log(`\n## ${relPath}`);
      console.log("  No structural changes.");
      continue;
    }

    hasChanges = true;
    console.log(`\n## ${relPath}`);
    console.log(`  Version: ${previous.version || "?"} → ${current.version || "?"}`);
    console.log("");

    // Classify changes
    const breaking = [];
    const nonBreaking = [];

    for (const item of diff.removed) {
      breaking.push(`  REMOVED  ${item.path}  (was: ${item.value})`);
    }

    for (const item of diff.changed) {
      if (isBreakingChange(item.path)) {
        breaking.push(`  CHANGED  ${item.path}  ${item.from} → ${item.to}`);
      } else {
        nonBreaking.push(`  CHANGED  ${item.path}  ${item.from} → ${item.to}`);
      }
    }

    for (const item of diff.added) {
      nonBreaking.push(`  ADDED    ${item.path}  (${item.value})`);
    }

    if (breaking.length > 0) {
      console.log("  BREAKING CHANGES:");
      for (const line of breaking) console.log(line);
      console.log("");
    }

    if (nonBreaking.length > 0) {
      console.log("  Non-breaking changes:");
      for (const line of nonBreaking) console.log(line);
      console.log("");
    }

    console.log(`  Summary: ${breaking.length} breaking, ${nonBreaking.length} non-breaking`);
  }

  return hasChanges ? 0 : 0;
}

// ---------------------------------------------------------------------------

function getPreviousVersion(root, relPath, targetVersion) {
  try {
    if (targetVersion) {
      // Find the commit where this version was set
      const logOutput = execSync(
        `git log --all --oneline -- "${relPath}"`,
        { cwd: root, encoding: "utf-8", timeout: 10000 }
      ).trim();

      const commits = logOutput.split("\n").filter(Boolean);
      for (const line of commits) {
        const sha = line.split(" ")[0];
        try {
          const content = execSync(
            `git show ${sha}:"${relPath}"`,
            { cwd: root, encoding: "utf-8", timeout: 5000 }
          );
          const obj = JSON.parse(content);
          if (obj.version === targetVersion) return obj;
        } catch { /* skip */ }
      }
      return null;
    }

    // Default: get the last committed version
    const content = execSync(
      `git show HEAD:"${relPath}"`,
      { cwd: root, encoding: "utf-8", timeout: 5000 }
    );
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function isBreakingChange(path) {
  // Removals are always breaking (handled separately)
  // Type changes on existing fields are breaking
  if (path.includes(".type")) return true;
  // Changes to required fields are breaking
  if (path.includes(".required")) return true;
  // Path changes on endpoints are breaking
  if (path.match(/endpoints\[\d+\]\.path$/)) return true;
  // Method changes on endpoints are breaking
  if (path.match(/endpoints\[\d+\]\.method$/)) return true;
  // Route path changes are breaking
  if (path.match(/routes\[\d+\]\.path$/)) return true;
  return false;
}

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}
