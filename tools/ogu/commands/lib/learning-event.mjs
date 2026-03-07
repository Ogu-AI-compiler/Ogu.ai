/**
 * learning-event.mjs — Slice 373
 * Creates and manages learning candidates from agent task outcomes.
 * Storage: .ogu/marketplace/learning-candidates/{event_id}.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getMarketplaceDir } from "./runtime-paths.mjs";

const EXCESSIVE_ITERATIONS_THRESHOLD = 3;
const EXCEPTIONAL_IMPROVEMENT_THRESHOLD = 0.5; // 50% duration drop

function candidateDir(root) {
  return join(getMarketplaceDir(root), "learning-candidates");
}

function ensureDirs(root) {
  mkdirSync(candidateDir(root), { recursive: true });
}

/**
 * detectLearningTrigger(outcome) → trigger string | null
 * outcome: { gateFailed?, iterationCount?, reviewerChangedStrategy?, durationDrop? }
 */
export function detectLearningTrigger(outcome) {
  if (outcome.gateFailed) return "gate_failure";
  if (outcome.iterationCount > 0 && outcome.reviewerChangedStrategy) return "review_rejection";
  if ((outcome.iterationCount ?? 0) > EXCESSIVE_ITERATIONS_THRESHOLD) return "excessive_iterations";
  if ((outcome.durationDrop ?? 0) > EXCEPTIONAL_IMPROVEMENT_THRESHOLD) return "exceptional_improvement";
  return null;
}

/**
 * createLearningCandidate(root, { agentId, taskType, contextSignature, failureSignals, resolutionSummary, iterationCount, trigger }) → LearningCandidate
 */
export function createLearningCandidate(root, {
  agentId,
  taskType,
  contextSignature,
  failureSignals,
  resolutionSummary,
  iterationCount,
  trigger,
}) {
  ensureDirs(root);
  const eventId = randomUUID();
  const candidate = {
    event_id:           eventId,
    agent_id:           agentId,
    task_type:          taskType,
    context_signature:  contextSignature,
    failure_signals:    failureSignals || [],
    resolution_summary: resolutionSummary || "",
    iteration_count:    iterationCount ?? 0,
    trigger:            trigger || null,
    status:             "pending",
    created_at:         new Date().toISOString(),
  };

  const filePath = join(candidateDir(root), `${eventId}.json`);
  writeFileSync(filePath, JSON.stringify(candidate, null, 2) + "\n", "utf-8");
  return candidate;
}

/**
 * listPendingCandidates(root) → all unprocessed candidates
 */
export function listPendingCandidates(root) {
  ensureDirs(root);
  const dir = candidateDir(root);
  const files = readdirSync(dir).filter(f => f.endsWith(".json") && !f.includes(".done"));
  return files.map(f => {
    try { return JSON.parse(readFileSync(join(dir, f), "utf-8")); }
    catch { return null; }
  }).filter(c => c && c.status === "pending");
}

/**
 * markCandidateProcessed(root, eventId) → void
 */
export function markCandidateProcessed(root, eventId) {
  const filePath = join(candidateDir(root), `${eventId}.json`);
  if (!existsSync(filePath)) throw new Error(`Candidate not found: ${eventId}`);
  const candidate = JSON.parse(readFileSync(filePath, "utf-8"));
  candidate.status = "processed";
  candidate.processed_at = new Date().toISOString();
  writeFileSync(filePath, JSON.stringify(candidate, null, 2) + "\n", "utf-8");
}
