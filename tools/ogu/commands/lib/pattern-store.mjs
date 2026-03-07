/**
 * pattern-store.mjs — Slice 375
 * Storage and retrieval for abstracted learning patterns.
 * Storage: .ogu/marketplace/patterns/{pattern_id}.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getMarketplaceDir } from "./runtime-paths.mjs";

function patternsDir(root) {
  return join(getMarketplaceDir(root), "patterns");
}

function ensureDirs(root) {
  mkdirSync(patternsDir(root), { recursive: true });
}

/**
 * savePattern(root, pattern) → pattern
 */
export function savePattern(root, pattern) {
  ensureDirs(root);
  const filePath = join(patternsDir(root), `${pattern.pattern_id}.json`);
  writeFileSync(filePath, JSON.stringify(pattern, null, 2) + "\n", "utf-8");
  return pattern;
}

/**
 * loadPattern(root, patternId) → pattern | null
 */
export function loadPattern(root, patternId) {
  const filePath = join(patternsDir(root), `${patternId}.json`);
  if (!existsSync(filePath)) return null;
  try { return JSON.parse(readFileSync(filePath, "utf-8")); }
  catch { return null; }
}

/**
 * listPatterns(root) → all patterns (active + inactive)
 */
export function listPatterns(root) {
  ensureDirs(root);
  const dir = patternsDir(root);
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  return files.map(f => {
    try { return JSON.parse(readFileSync(join(dir, f), "utf-8")); }
    catch { return null; }
  }).filter(Boolean);
}

/**
 * computeConfidence(pattern) → float
 * confidence = success_count / (success_count + failure_count + 1)
 */
function computeConfidence(pattern) {
  const s = pattern.success_count || 0;
  const f = pattern.failure_count || 0;
  return s / (s + f + 1);
}

/**
 * tagSimilarity(tagsA, tagsB) → 0..1
 */
function tagSimilarity(tagsA, tagsB) {
  if (!tagsA?.length || !tagsB?.length) return 0;
  const setA = new Set(tagsA);
  const setB = new Set(tagsB);
  let overlap = 0;
  for (const t of setA) { if (setB.has(t)) overlap++; }
  return overlap / Math.max(setA.size, setB.size);
}

/**
 * searchPatterns(root, { taskType, contextSignature }, limit=3)
 * Returns top N patterns by confidence matching signature tags.
 */
export function searchPatterns(root, { taskType, contextSignature } = {}, limit = 3) {
  const all = listPatterns(root).filter(p => p.active !== false);

  return all
    .map(p => {
      let score = p.confidence || computeConfidence(p);
      if (taskType && p.task_type === taskType) score += 0.2;
      if (contextSignature) {
        const tags = Array.isArray(contextSignature) ? contextSignature : [contextSignature];
        score += tagSimilarity(p.context_signature || [], tags) * 0.3;
      }
      return { pattern: p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.pattern);
}

/**
 * recordOutcome(root, patternId, success) → updated pattern
 * Deactivates pattern if confidence drops below 0.2.
 */
export function recordOutcome(root, patternId, success) {
  const pattern = loadPattern(root, patternId);
  if (!pattern) throw new Error(`Pattern not found: ${patternId}`);

  if (success) {
    pattern.success_count = (pattern.success_count || 0) + 1;
  } else {
    pattern.failure_count = (pattern.failure_count || 0) + 1;
  }
  pattern.confidence = computeConfidence(pattern);
  pattern.last_used_at = new Date().toISOString();

  if (pattern.confidence < 0.2) {
    pattern.active = false;
  }

  return savePattern(root, pattern);
}

/**
 * mergePattern(root, existingId, newCandidate) → updated pattern
 */
export function mergePattern(root, existingId, newCandidate) {
  const existing = loadPattern(root, existingId);
  if (!existing) throw new Error(`Pattern not found: ${existingId}`);
  // Merge context signature tags
  const merged = new Set([
    ...(existing.context_signature || []),
    ...(Array.isArray(newCandidate.context_signature) ? newCandidate.context_signature : []),
  ]);
  existing.context_signature = [...merged];
  existing.last_used_at = new Date().toISOString();
  return savePattern(root, existing);
}

/**
 * pruneDecayed(root, daysSinceUse=90) → number of deactivated patterns
 */
export function pruneDecayed(root, daysSinceUse = 90) {
  const all = listPatterns(root);
  const cutoff = Date.now() - daysSinceUse * 24 * 60 * 60 * 1000;
  let count = 0;
  for (const p of all) {
    if (!p.active) continue;
    const lastUsed = p.last_used_at ? new Date(p.last_used_at).getTime() : new Date(p.created_at).getTime();
    if (lastUsed < cutoff) {
      p.active = false;
      savePattern(root, p);
      count++;
    }
  }
  return count;
}

/**
 * findSimilarPattern(root, tags) → pattern | null
 * Returns existing pattern if similarity > 0.8.
 */
export async function findSimilarPattern(root, tags) {
  const all = listPatterns(root).filter(p => p.active !== false);
  for (const p of all) {
    if (tagSimilarity(p.context_signature || [], tags) > 0.8) return p;
  }
  return null;
}

/**
 * injectIntoPrompt(patterns) → formatted prompt section string
 */
export function injectIntoPrompt(patterns) {
  if (!patterns || patterns.length === 0) return "";
  const lines = ["## Learned Patterns\nApply these patterns based on past outcomes:\n"];
  for (const p of patterns) {
    lines.push(`### ${p.task_type || "Pattern"} (confidence: ${(p.confidence || 0).toFixed(2)})`);
    lines.push(`**Tags**: ${(p.context_signature || []).join(", ")}`);
    lines.push(`**Resolution**: ${p.resolution_summary || "N/A"}`);
    lines.push("");
  }
  return lines.join("\n");
}
