/**
 * execution-memory.mjs — Slice 424
 * Integrates pattern injection and learning into the project execution loop.
 *
 * Before each task:   searchPatterns → injectIntoPrompt → task._patternContext
 * After each task:    detectLearningTrigger → createLearningCandidate
 *                     recordOutcome (update confidence of injected patterns)
 * At project end:     processCandidates → abstract all pending patterns
 *
 * Exports:
 *   injectPatternsForTask(root, task) → EnrichedTask
 *   recordTaskOutcome(root, task, result, iterationCount?) → LearningCandidate | null
 *   updatePatternOutcomes(root, injectedPatterns, success) → void
 *   finalizeProjectMemory(root) → { processed, patterns }
 */

import { searchPatterns, injectIntoPrompt, recordOutcome } from './pattern-store.mjs';
import { createLearningCandidate, detectLearningTrigger } from './learning-event.mjs';
import { processCandidates } from './reflector.mjs';

// ── Pattern injection ─────────────────────────────────────────────────────────

/**
 * injectPatternsForTask(root, task) → task with _patternContext / _injectedPatterns
 * Does NOT mutate the original task. Returns a new object.
 * If no patterns found, returns the task unchanged.
 */
export function injectPatternsForTask(root, task) {
  if (!task || typeof task !== 'object') return task;

  let patterns = [];
  try {
    const taskType = task.owner_role || 'general';
    const contextSignature = {
      taskType,
      gates: task.gates || [],
      featureId: task.feature_id || null,
    };
    patterns = searchPatterns(root, { taskType, contextSignature }, 3);
  } catch {
    // Pattern store may be empty or uninitialized — safe to skip
    return task;
  }

  if (patterns.length === 0) return task;

  let patternHint = '';
  try {
    patternHint = injectIntoPrompt(patterns);
  } catch {
    return task;
  }

  return {
    ...task,
    _patternContext: patternHint,
    _injectedPatterns: patterns.map(p => p.pattern_id).filter(Boolean),
  };
}

// ── Learning candidate creation ───────────────────────────────────────────────

/**
 * recordTaskOutcome(root, task, result, iterationCount?) → LearningCandidate | null
 *
 * Creates a learning candidate if the outcome warrants it (via detectLearningTrigger).
 * Returns the candidate, or null if no learning trigger detected.
 *
 * result: { success, status, error?, durationMs? }
 */
export function recordTaskOutcome(root, task, result, iterationCount = 0) {
  if (!root || !task || !result) return null;

  const outcome = {
    success: !!result.success,
    status: result.status || (result.success ? 'completed' : 'failed'),
    iterationCount,
    gatesPassed: !!result.success,
    durationMs: result.durationMs || 0,
  };

  let trigger;
  try {
    trigger = detectLearningTrigger(outcome);
  } catch {
    return null;
  }
  if (!trigger) return null;

  try {
    return createLearningCandidate(root, {
      agentId: task.owner_agent_id || task.owner_role || 'unknown',
      taskType: task.owner_role || 'general',
      contextSignature: JSON.stringify({
        gates: task.gates || [],
        featureId: task.feature_id || null,
        role: task.owner_role || null,
      }),
      failureSignals: result.error ? [result.error] : [],
      resolutionSummary: result.success
        ? `Task "${task.name || task.id}" completed successfully after ${iterationCount} iteration(s)`
        : `Task "${task.name || task.id}" failed: ${result.status || 'unknown'}`,
      iterationCount,
      trigger,
    });
  } catch {
    return null;
  }
}

// ── Pattern outcome feedback ──────────────────────────────────────────────────

/**
 * updatePatternOutcomes(root, injectedPatterns, success) → void
 * Updates confidence scores for patterns that were used in a task.
 * Uses recordOutcome from pattern-store.
 * Best-effort: silently skips errors.
 */
export function updatePatternOutcomes(root, injectedPatterns = [], success) {
  if (!Array.isArray(injectedPatterns)) return;
  for (const patternId of injectedPatterns) {
    try {
      recordOutcome(root, patternId, !!success);
    } catch { /* best-effort */ }
  }
}

// ── Project finalization ──────────────────────────────────────────────────────

/**
 * finalizeProjectMemory(root) → { processed, patterns }
 * Runs the reflector: processes all pending learning candidates → abstract patterns.
 * Called at the end of project execution.
 */
export async function finalizeProjectMemory(root) {
  try {
    const result = await processCandidates(root);
    // processCandidates returns void or a summary depending on implementation
    if (result && typeof result === 'object') return result;
    return { processed: 0, patterns: 0 };
  } catch {
    // Pattern system may be unavailable — non-fatal
    return { processed: 0, patterns: 0 };
  }
}
