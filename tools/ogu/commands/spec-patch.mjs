// SCR (Spec Change Record) creation command.
// Usage: ogu spec:patch <slug> "description" --reason "..." --impact "plan|spec|both"

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { repoRoot, readJsonSafe } from "../util.mjs";

export async function specPatch() {
  const args = process.argv.slice(3);
  const slug = args.find((a) => !a.startsWith("--") && !a.startsWith('"'));
  const description = args.find((a, i) => i > 0 && !a.startsWith("--") && a !== slug);
  const reason = parseFlag(args, "--reason") || "Not specified";
  const impact = parseFlag(args, "--impact") || "both";

  if (!slug || !description) {
    console.error('Usage: ogu spec:patch <slug> "description" --reason "..." --impact "plan|spec|both"');
    return 1;
  }

  const root = repoRoot();
  const featureDir = join(root, `docs/vault/04_Features/${slug}`);

  if (!existsSync(featureDir)) {
    console.error(`  ERROR  Feature directory not found: docs/vault/04_Features/${slug}/`);
    return 1;
  }

  const specPath = join(featureDir, "Spec.md");
  if (!existsSync(specPath)) {
    console.error(`  ERROR  Spec.md not found for feature "${slug}"`);
    return 1;
  }

  // Hash the CURRENT Spec.md (before the user's edit — this is the "previous" hash)
  // Note: the user should have already edited Spec.md. We hash the current version as "current".
  // To get previous, we check the last SCR's current_hash, or the lock hash.
  const currentSpecContent = readFileSync(specPath, "utf-8");
  const currentSpecHash = hashContent(currentSpecContent);

  // Find the previous hash: last SCR's current_spec_hash, or lock hash
  const previousHash = findPreviousHash(root, slug, featureDir);

  if (previousHash === currentSpecHash) {
    console.log("  info     Spec.md has not changed since last record. No SCR created.");
    return 0;
  }

  // Auto-number SCR (scoped per feature)
  const scrNumber = getNextSCRNumber(featureDir);
  const scrName = `SCR_${String(scrNumber).padStart(3, "0")}`;
  const scrFileName = `${scrName}_${slugify(description)}.md`;

  // Determine plan tasks affected
  const planPath = join(featureDir, "Plan.json");
  const plan = readJsonSafe(planPath);
  const affectedTasks = plan?.tasks
    ? plan.tasks.filter((t) => t.spec_section && currentSpecContent.includes(t.spec_section)).map((t) => `Task ${t.id}: ${t.title}`)
    : [];

  const scrContent = `# ${scrName}: ${description}

**Feature:** ${slug}
**Date:** ${new Date().toISOString().split("T")[0]}
**Status:** applied

## What Changed
${description}

## Why
${reason}

## Impact
- Plan.json tasks affected: ${affectedTasks.length > 0 ? affectedTasks.join(", ") : "none identified"}
- Re-run /architect: ${impact === "spec" ? "no" : "recommended"}
- Re-run /preflight: ${impact === "plan" ? "no" : "yes"}

## Hash Chain
- previous_spec_hash: ${previousHash || "none (first record)"}
- current_spec_hash: ${currentSpecHash}
`;

  writeFileSync(join(featureDir, scrFileName), scrContent, "utf-8");

  // Update STATE.json recent_scrs
  const statePath = join(root, ".ogu/STATE.json");
  try {
    const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf-8")) : {};
    if (!state.recent_scrs) state.recent_scrs = [];
    state.recent_scrs.push({
      id: scrName,
      feature: slug,
      description,
      date: new Date().toISOString().split("T")[0],
    });
    // Keep last 20 SCRs
    if (state.recent_scrs.length > 20) state.recent_scrs = state.recent_scrs.slice(-20);
    writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
  } catch { /* best-effort */ }

  console.log(`  created  ${scrFileName}`);
  console.log(`  prev     ${previousHash ? previousHash.slice(0, 12) + "..." : "none"}`);
  console.log(`  current  ${currentSpecHash.slice(0, 12)}...`);
  if (affectedTasks.length > 0) {
    console.log(`  affects  ${affectedTasks.length} task(s)`);
  }

  return 0;
}

function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}

function findPreviousHash(root, slug, featureDir) {
  // First: check last SCR's current_spec_hash
  const scrs = getSCRFiles(featureDir);
  if (scrs.length > 0) {
    const lastSCR = readFileSync(join(featureDir, scrs[scrs.length - 1]), "utf-8");
    const match = lastSCR.match(/current_spec_hash:\s*(\S+)/);
    if (match) return match[1];
  }

  // Second: check context lock
  const lockPath = join(root, ".ogu/CONTEXT_LOCK.json");
  if (existsSync(lockPath)) {
    try {
      const lock = JSON.parse(readFileSync(lockPath, "utf-8"));
      if (lock.spec_hashes && lock.spec_hashes[slug]) {
        return lock.spec_hashes[slug];
      }
    } catch { /* skip */ }
  }

  return null;
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

function getNextSCRNumber(featureDir) {
  const scrs = getSCRFiles(featureDir);
  if (scrs.length === 0) return 1;
  const lastNum = parseInt(scrs[scrs.length - 1].match(/SCR_(\d{3})/)[1], 10);
  return lastNum + 1;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

function parseFlag(args, flag) {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}
