import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { repoRoot, readJsonSafe } from "../util.mjs";
import { resolveRuntimePath } from "./lib/runtime-paths.mjs";

const LOCK_SOURCES = {
  context_hash: {
    kind: "context",
    label: ".ogu/CONTEXT.md",
    path: (root) => resolveRuntimePath(root, "CONTEXT.md"),
  },
  state_hash: {
    kind: "state",
    label: ".ogu/STATE.json",
    path: (root) => resolveRuntimePath(root, "STATE.json"),
  },
  repo_map_hash: {
    kind: "repo_map",
    label: "docs/vault/01_Architecture/Repo_Map.md",
    path: (root) => join(root, "docs/vault/01_Architecture/Repo_Map.md"),
  },
};

const CONTRACT_SCHEMAS = [
  "docs/vault/02_Contracts/api.contract.json",
  "docs/vault/02_Contracts/navigation.contract.json",
  "docs/vault/02_Contracts/design.tokens.json",
];

export function hashFile(path, kind = null) {
  if (!existsSync(path)) return null;
  let content = readFileSync(path, "utf-8");
  // Strip non-deterministic lines before hashing
  if (kind === "context") {
    content = content
      .split("\n")
      .filter((l) => !l.startsWith("<!--"))
      .join("\n");
  }
  if (kind === "state") {
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

  for (const [key, source] of Object.entries(LOCK_SOURCES)) {
    const hash = hashFile(source.path(root), source.kind);
    if (!hash) {
      console.error(`  ERROR  Missing file: ${source.label}`);
      return 1;
    }
    lock[key] = hash;
  }

  // Hash contract schema files (optional — skip if not yet created)
  for (const relPath of CONTRACT_SCHEMAS) {
    const hash = hashFile(join(root, relPath));
    if (hash) {
      const key = `contract_${relPath.replace(/[/.]/g, "_")}`;
      lock[key] = hash;
    }
  }

  // Hash Spec.md for the active feature (if any)
  const statePath = resolveRuntimePath(root, "STATE.json");
  const state = readJsonSafe(statePath);
  const activeFeature = state?.current_task;
  if (activeFeature) {
    const specPath = `docs/vault/04_Features/${activeFeature}/Spec.md`;
    const specHash = hashFile(join(root, specPath));
    if (specHash) {
      if (!lock.spec_hashes) lock.spec_hashes = {};
      lock.spec_hashes[activeFeature] = specHash;
    }
  }

  // Also hash any features with existing spec_hashes from previous lock
  const existingLock = readJsonSafe(resolveRuntimePath(root, "CONTEXT_LOCK.json"));
  if (existingLock?.spec_hashes) {
    if (!lock.spec_hashes) lock.spec_hashes = {};
    for (const [slug, _] of Object.entries(existingLock.spec_hashes)) {
      if (slug === activeFeature) continue; // Already done
      const specPath = `docs/vault/04_Features/${slug}/Spec.md`;
      const specHash = hashFile(join(root, specPath));
      if (specHash) lock.spec_hashes[slug] = specHash;
    }
  }

  const lockPath = resolveRuntimePath(root, "CONTEXT_LOCK.json");
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf-8");

  console.log("  locked   .ogu/CONTEXT_LOCK.json");
  console.log(`  context  ${lock.context_hash.slice(0, 12)}...`);
  console.log(`  state    ${lock.state_hash.slice(0, 12)}...`);
  console.log(`  repo_map ${lock.repo_map_hash.slice(0, 12)}...`);
  if (lock.spec_hashes) {
    for (const [slug, hash] of Object.entries(lock.spec_hashes)) {
      console.log(`  spec     ${slug}: ${hash.slice(0, 12)}...`);
    }
  }
  return 0;
}
