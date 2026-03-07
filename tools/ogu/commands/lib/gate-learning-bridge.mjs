/**
 * gate-learning-bridge.mjs — Slice 436
 * Converts structured gate feedback into learning candidates.
 *
 * When a gate fails with structured feedback and is later resolved,
 * this module creates a learning candidate that captures:
 *   - What gate failed and why (structured errors)
 *   - How it was fixed (iteration delta)
 *   - Context signature (gate type + task type + error codes)
 *
 * This bridges gate-feedback.mjs → learning-event.mjs → agent-trainer.mjs
 *
 * Exports:
 *   buildLearningFromGateFeedback(gateResult, resolution, taskSpec) → LearningInput
 *   extractContextSignature(structured, gate) → string[]
 *   extractFailureSignals(structured, gate) → string[]
 *   buildResolutionSummary(gate, structured, iterationCount) → string
 *   processGateResolution(root, opts) → LearningCandidate | null
 */

import { createLearningCandidate } from './learning-event.mjs';

// ── Context signature extraction ─────────────────────────────────────────────

/**
 * extractContextSignature(structured, gate) → string[]
 * Builds searchable tags from structured gate output.
 */
export function extractContextSignature(structured, gate) {
  const tags = [`gate:${gate}`];

  if (!structured) return tags;

  if (gate === 'type-check' && structured.errors?.length > 0) {
    const codes = [...new Set(structured.errors.map(e => e.code).filter(Boolean))];
    for (const code of codes.slice(0, 5)) tags.push(`ts:${code}`);
    const files = [...new Set(structured.errors.map(e => e.file).filter(Boolean))];
    for (const f of files.slice(0, 3)) {
      const ext = f.split('.').pop();
      if (ext) tags.push(`ext:${ext}`);
    }
  }

  if (gate === 'tests-pass' && structured.failures?.length > 0) {
    tags.push(`test-failures:${structured.failures.length}`);
    for (const f of structured.failures.slice(0, 3)) {
      if (f.name) {
        // Extract test suite name (first part before >)
        const suite = f.name.split('>')[0].trim().split(' ').slice(0, 2).join('-').toLowerCase();
        if (suite) tags.push(`suite:${suite}`);
      }
    }
  }

  if (gate === 'schema-valid' && structured.errors?.length > 0) {
    tags.push(`schema-errors:${structured.errors.length}`);
  }

  if (gate === 'no-syntax-error' && structured.errors?.length > 0) {
    const files = [...new Set(structured.errors.map(e => e.file).filter(Boolean))];
    for (const f of files.slice(0, 3)) {
      const ext = f.split('.').pop();
      if (ext) tags.push(`ext:${ext}`);
    }
  }

  if (gate === 'output-exists' && structured.missing?.length > 0) {
    tags.push(`missing-files:${structured.missing.length}`);
  }

  return tags;
}

// ── Failure signal extraction ────────────────────────────────────────────────

/**
 * extractFailureSignals(structured, gate) → string[]
 * Extracts concrete failure signals for pattern matching.
 */
export function extractFailureSignals(structured, gate) {
  const signals = [];

  if (!structured) return [`${gate}-unknown`];

  if (gate === 'type-check' && structured.errors?.length > 0) {
    for (const e of structured.errors.slice(0, 3)) {
      signals.push(e.code ? `${e.code}: ${e.message?.slice(0, 80)}` : e.message?.slice(0, 100));
    }
  }

  if (gate === 'tests-pass' && structured.failures?.length > 0) {
    for (const f of structured.failures.slice(0, 3)) {
      let sig = `FAIL: ${f.name?.slice(0, 60)}`;
      if (f.expected && f.actual) sig += ` (expected=${f.expected}, got=${f.actual})`;
      signals.push(sig);
    }
  }

  if (gate === 'schema-valid' && structured.errors?.length > 0) {
    for (const e of structured.errors.slice(0, 3)) {
      signals.push(String(e).slice(0, 100));
    }
  }

  if (gate === 'no-syntax-error' && structured.errors?.length > 0) {
    for (const e of structured.errors.slice(0, 3)) {
      signals.push(`syntax-error at ${e.file}:${e.line}`);
    }
  }

  if (gate === 'output-exists' && structured.missing?.length > 0) {
    for (const m of structured.missing.slice(0, 3)) {
      signals.push(`missing: ${m}`);
    }
  }

  return signals.length > 0 ? signals : [`${gate}-failure`];
}

// ── Resolution summary builder ───────────────────────────────────────────────

/**
 * buildResolutionSummary(gate, structured, iterationCount) → string
 * Generates a human-readable summary of how the failure was resolved.
 */
export function buildResolutionSummary(gate, structured, iterationCount = 1) {
  const parts = [`Fixed ${gate} failure in ${iterationCount} iteration(s).`];

  if (gate === 'type-check' && structured?.errors?.length > 0) {
    const codes = [...new Set(structured.errors.map(e => e.code).filter(Boolean))];
    if (codes.length > 0) {
      parts.push(`Resolved TypeScript errors: ${codes.join(', ')}.`);
    }
    parts.push('Check type annotations and import paths before submitting.');
  }

  if (gate === 'tests-pass' && structured?.failures?.length > 0) {
    parts.push(`Fixed ${structured.failures.length} failing test(s).`);
    parts.push('Run tests locally and verify expected values match implementation.');
  }

  if (gate === 'schema-valid') {
    parts.push('Ensure all required fields are present and match the expected schema.');
  }

  if (gate === 'no-syntax-error') {
    parts.push('Validate syntax before submission. Check for unclosed brackets and missing semicolons.');
  }

  if (gate === 'output-exists' && structured?.missing?.length > 0) {
    parts.push(`Created ${structured.missing.length} missing output file(s).`);
    parts.push('Verify all output_artifacts paths are written.');
  }

  return parts.join(' ');
}

// ── Main bridge: structured feedback → learning input ────────────────────────

/**
 * buildLearningFromGateFeedback(gateResult, resolution, taskSpec) → LearningInput
 *
 * gateResult: { gate, passed, output, structured }
 * resolution: { iterationCount, durationMs, success }
 * taskSpec: { id, name, owner_role, owner_agent_id }
 */
export function buildLearningFromGateFeedback(gateResult, resolution = {}, taskSpec = {}) {
  const gate = gateResult?.gate || 'unknown';
  const structured = gateResult?.structured || null;
  const iterationCount = resolution.iterationCount || 1;

  return {
    agentId: taskSpec.owner_agent_id || null,
    taskType: taskSpec.owner_role || taskSpec.name || 'unknown',
    contextSignature: extractContextSignature(structured, gate),
    failureSignals: extractFailureSignals(structured, gate),
    resolutionSummary: buildResolutionSummary(gate, structured, iterationCount),
    iterationCount,
    trigger: iterationCount >= 3 ? 'excessive_iterations' : 'gate_failure',
  };
}

// ── Full processing: create learning candidate from gate resolution ──────────

/**
 * processGateResolution(root, opts) → LearningCandidate | null
 *
 * opts:
 *   gateResult   — the original gate failure result (with structured field)
 *   resolution   — { iterationCount, durationMs, success }
 *   taskSpec     — enriched task spec
 *   minIterations — minimum iterations before creating candidate (default 1)
 */
export function processGateResolution(root, opts = {}) {
  const {
    gateResult,
    resolution = {},
    taskSpec = {},
    minIterations = 1,
  } = opts;

  // Only process resolved failures (success=true after retry)
  if (!resolution.success) return null;

  // Skip trivial single-pass fixes unless forced
  const iterationCount = resolution.iterationCount || 1;
  if (iterationCount < minIterations) return null;

  // Skip if no structured data — can't learn from opaque failures
  if (!gateResult?.structured) return null;

  const learningInput = buildLearningFromGateFeedback(gateResult, resolution, taskSpec);

  // Don't create candidate if no agent to attribute to
  if (!learningInput.agentId) return null;

  return createLearningCandidate(root, learningInput);
}
