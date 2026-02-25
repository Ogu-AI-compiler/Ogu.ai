import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { repoRoot } from "../util.mjs";

const LOCK_SOURCES = {
  context_hash: ".ogu/CONTEXT.md",
  state_hash: ".ogu/STATE.json",
  repo_map_hash: "docs/vault/01_Architecture/Repo_Map.md",
};

const CONTRACT_SCHEMAS = [
  "docs/vault/02_Contracts/api.contract.json",
  "docs/vault/02_Contracts/navigation.contract.json",
  "docs/vault/02_Contracts/design.tokens.json",
];

export function hashFile(root, relPath) {
  const full = join(root, relPath);
  if (!existsSync(full)) return null;
  let content = readFileSync(full, "utf-8");
  // Strip non-deterministic lines before hashing
  if (relPath === ".ogu/CONTEXT.md") {
    content = content
      .split("\n")
      .filter((l) => !l.startsWith("<!--"))
      .join("\n");
  }
  if (relPath === ".ogu/STATE.json") {
    try {
      const obj = JSON.parse(content);
      delete obj.last_context_build;
      delete obj.last_repo_map_update;
      content = JSON.stringify(obj);
    } catch { /* hash raw content */ }
  }
  return createHash("sha256").update(content).digest("hex");
}

export async function contextLock() {
  const root = repoRoot();
  const lock = { timestamp: new Date().toISOString() };

  for (const [key, relPath] of Object.entries(LOCK_SOURCES)) {
    const hash = hashFile(root, relPath);
    if (!hash) {
      console.error(`  ERROR  Missing file: ${relPath}`);
      return 1;
    }
    lock[key] = hash;
  }

  // Hash contract schema files (optional — skip if not yet created)
  for (const relPath of CONTRACT_SCHEMAS) {
    const hash = hashFile(root, relPath);
    if (hash) {
      const key = `contract_${relPath.replace(/[/.]/g, "_")}`;
      lock[key] = hash;
    }
  }

  const lockPath = join(root, ".ogu/CONTEXT_LOCK.json");
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf-8");

  console.log("  locked   .ogu/CONTEXT_LOCK.json");
  console.log(`  context  ${lock.context_hash.slice(0, 12)}...`);
  console.log(`  state    ${lock.state_hash.slice(0, 12)}...`);
  console.log(`  repo_map ${lock.repo_map_hash.slice(0, 12)}...`);
  return 0;
}
