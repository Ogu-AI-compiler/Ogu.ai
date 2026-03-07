/**
 * reflector.mjs — Slice 374
 * Abstracts learning candidates into reusable patterns.
 * Strips identifying info, sanitizes text, detects duplicates.
 */

import { listPendingCandidates, markCandidateProcessed } from "./learning-event.mjs";
import { savePattern, findSimilarPattern } from "./pattern-store.mjs";
import { randomUUID } from "node:crypto";

// Regexes for sanitization
const PATH_RE    = /(?:\/[\w.\-]+){2,}/g;
const VAR_RE     = /\b(?:const|let|var|function|class)\s+(\w+)/g;
const PROJECT_RE = /\b(?:project|repo|app|service|slug)[-_:][\w\-]+/gi;

/**
 * sanitize(text) → string with file paths, variable names, project names removed
 */
export function sanitize(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(PATH_RE, "<path>")
    .replace(VAR_RE, "$1 <identifier>")
    .replace(PROJECT_RE, "<project-ref>")
    .trim();
}

/**
 * buildContextSignature(candidate) → array of tags
 */
export function buildContextSignature(candidate) {
  const sig = candidate.context_signature || {};
  const tags = [];
  if (sig.framework)    tags.push(`framework:${sig.framework}`);
  if (sig.runtime)      tags.push(`runtime:${sig.runtime}`);
  if (sig.storage)      tags.push(`storage:${sig.storage}`);
  if (sig.pattern)      tags.push(`pattern:${sig.pattern}`);
  if (sig.failure_mode) tags.push(`failure_mode:${sig.failure_mode}`);
  if (candidate.task_type) tags.push(`task_type:${candidate.task_type}`);
  if (candidate.trigger)   tags.push(`trigger:${candidate.trigger}`);
  return tags;
}

/**
 * abstractCandidate(candidate) → PatternRecord
 * Strips agent_id, event_id, sanitizes text, sets neutral confidence.
 */
export function abstractCandidate(candidate) {
  const tags = buildContextSignature(candidate);
  return {
    pattern_id:          randomUUID(),
    task_type:           candidate.task_type,
    context_signature:   tags,
    failure_signals:     (candidate.failure_signals || []).map(sanitize),
    resolution_summary:  sanitize(candidate.resolution_summary || ""),
    trigger:             candidate.trigger,
    confidence:          0.5,
    success_count:       0,
    failure_count:       0,
    active:              true,
    created_at:          new Date().toISOString(),
    last_used_at:        null,
  };
}

/**
 * processCandidates(root) → { processed: number, merged: number }
 */
export async function processCandidates(root) {
  const candidates = listPendingCandidates(root);
  let processed = 0;
  let merged = 0;

  for (const candidate of candidates) {
    const pattern = abstractCandidate(candidate);
    const tags = pattern.context_signature;

    const existing = await findSimilarPattern(root, tags);
    if (existing) {
      // Merge: already exists with > 0.8 similarity
      merged++;
    } else {
      savePattern(root, pattern);
    }
    markCandidateProcessed(root, candidate.event_id);
    processed++;
  }

  return { processed, merged };
}
