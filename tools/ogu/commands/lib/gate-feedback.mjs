/**
 * gate-feedback.mjs — Slice 423
 * Gate failure → structured feedback → agent re-iteration.
 *
 * When a task fails a gate check, this module:
 *   1. Builds a structured feedback message from the gate result
 *   2. Saves a feedback record to disk
 *   3. Re-runs the task via executeAgentTaskCore with feedback appended
 *   4. Optionally creates a learning candidate if iteration threshold exceeded
 *
 * Exports:
 *   buildGateFeedback(gateResult, task) → FeedbackMessage
 *   createFeedbackRecord(root, taskId, gateResult, feedback) → FeedbackRecord
 *   detectLearningOpportunity(gateResult, iterationCount) → string | null
 *   retryWithFeedback(root, taskId, featureSlug, gateResult, opts) → RetryResult
 *   listFeedbackRecords(root, taskId) → FeedbackRecord[]
 *   clearFeedbackRecords(root, taskId) → void
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { executeAgentTaskCore } from './agent-executor.mjs';
import { getGateFeedbackDir } from './runtime-paths.mjs';

// ── Gate feedback builder ─────────────────────────────────────────────────────

const GATE_ADVICE = {
  'type-check': 'Fix TypeScript type errors. Check type annotations, missing imports, and incorrect interface implementations.',
  'tests-pass': 'Fix failing tests. Review test expectations and ensure the implementation matches what the tests require.',
  'migration-runs': 'Fix the database migration. Check SQL syntax, column types, and migration order.',
  'schema-valid': 'Fix the schema/contract JSON. Ensure all required fields are present and values match the spec.',
  'no-syntax-error': 'Fix syntax errors in the output file. Check for unclosed brackets, invalid exports, or missing semicolons.',
  'output-exists': 'Ensure the output file is created. The task must write output to the expected path.',
  'lint-pass': 'Fix linting violations. Run eslint --fix on the output file and address remaining issues.',
  'build-pass': 'Fix build errors. Check import paths, missing dependencies, and compilation errors.',
};

/**
 * buildGateFeedback(gateResult, task) → FeedbackMessage
 *
 * gateResult: { gate, passed, error?, output?, details? }
 * task: EnrichedTask from task-enricher
 */
export function buildGateFeedback(gateResult, task = {}) {
  if (!gateResult || typeof gateResult !== 'object') {
    return { gate: 'unknown', message: 'Gate check failed — no details available.', advice: '', severity: 'error' };
  }

  const gate = gateResult.gate || 'unknown';
  const advice = GATE_ADVICE[gate] || `Gate "${gate}" failed. Review the output and correct the issue.`;

  const parts = [`Gate "${gate}" failed.`];

  // Try structured parsing first
  let structured = null;
  const parser = GATE_PARSERS[gate];
  if (parser && gateResult.output) {
    try {
      structured = parser(String(gateResult.output), task);
    } catch { /* fall back to generic */ }
  }

  const formattedStructured = structured ? formatParsedOutput(gate, structured) : '';

  if (formattedStructured) {
    parts.push(`\nStructured errors:\n${formattedStructured}`);
  } else if (gateResult.output) {
    // Fall back to truncated output for unknown gates
    const out = String(gateResult.output).slice(0, 800);
    parts.push(`\nGate output:\n${out}`);
  }

  if (gateResult.error) {
    parts.push(`\nError: ${gateResult.error}`);
  }
  if (gateResult.details) {
    parts.push(`\nDetails: ${JSON.stringify(gateResult.details)}`);
  }

  parts.push(`\n\nFix guidance: ${advice}`);

  if (task.definition_of_done) {
    parts.push(`\nDefinition of done: ${task.definition_of_done}`);
  }
  if (task.output_artifacts?.length > 0) {
    parts.push(`\nExpected outputs: ${task.output_artifacts.join(', ')}`);
  }

  return {
    gate,
    message: parts.join(''),
    advice,
    severity: 'error',
    taskId: task.id || null,
    taskName: task.name || null,
    structured,
  };
}

// ── Per-gate-type structured parsers ──────────────────────────────────────────

/**
 * parseTypeCheckOutput(output) → { errors: [{file, line, code, message}] }
 * Parses tsc-style output: "src/foo.ts(12,5): error TS2345: Argument..."
 */
export function parseTypeCheckOutput(output) {
  if (!output || typeof output !== 'string') return { errors: [] };
  const errors = [];
  const re = /^(.+?)\((\d+),\d+\):\s*error\s+(TS\d+):\s*(.+)$/gm;
  let m;
  while ((m = re.exec(output)) !== null && errors.length < 5) {
    errors.push({ file: m[1], line: parseInt(m[2], 10), code: m[3], message: m[4].trim() });
  }
  return { errors };
}

/**
 * parseTestsPassOutput(output) → { failures: [{name, expected, actual}] }
 * Parses Jest/Vitest failure blocks.
 */
export function parseTestsPassOutput(output) {
  if (!output || typeof output !== 'string') return { failures: [] };
  const failures = [];
  // Pattern: "● Test Suite > test name" or "FAIL test name" then Expected/Received
  const blocks = output.split(/(?=●|FAIL\s)/);
  for (const block of blocks) {
    if (failures.length >= 3) break;
    const nameMatch = block.match(/(?:●|FAIL)\s+(.+?)(?:\n|$)/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    const expectedMatch = block.match(/Expected[:\s]+(.+?)(?:\n|$)/i);
    const actualMatch = block.match(/Received[:\s]+(.+?)(?:\n|$)/i);
    failures.push({
      name,
      expected: expectedMatch ? expectedMatch[1].trim() : null,
      actual: actualMatch ? actualMatch[1].trim() : null,
    });
  }
  return { failures };
}

/**
 * parseSchemaValidOutput(output) → { errors: string[] }
 * Extracts error lines from schema validation output.
 */
export function parseSchemaValidOutput(output) {
  if (!output || typeof output !== 'string') return { errors: [] };
  const errors = [];
  for (const line of output.split('\n')) {
    if (errors.length >= 8) break;
    const trimmed = line.trim();
    if (/error|invalid|missing|required|must\b/i.test(trimmed) && trimmed.length > 5) {
      errors.push(trimmed);
    }
  }
  return { errors };
}

/**
 * parseSyntaxErrorOutput(output) → { errors: [{file, line}] }
 * Parses syntax error output (Node.js / ESLint style).
 */
export function parseSyntaxErrorOutput(output) {
  if (!output || typeof output !== 'string') return { errors: [] };
  const errors = [];
  // Node-style: "path/file.js:12" or "at path/file.js:12:5"
  const re = /(?:^|\s|at\s+)([^\s:]+\.\w+):(\d+)/gm;
  let m;
  const seen = new Set();
  while ((m = re.exec(output)) !== null && errors.length < 3) {
    const key = `${m[1]}:${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push({ file: m[1], line: parseInt(m[2], 10) });
  }
  return { errors };
}

/**
 * parseOutputExistsOutput(output, task) → { missing: string[] }
 * Lists missing output files referenced in gate output or task spec.
 */
export function parseOutputExistsOutput(output, task = {}) {
  const missing = [];
  // Extract from output: lines mentioning "not found" or "missing"
  if (output && typeof output === 'string') {
    for (const line of output.split('\n')) {
      const fileMatch = line.match(/(?:not found|missing|does not exist)[:\s]*([^\s,]+\.\w+)/i);
      if (fileMatch && !missing.includes(fileMatch[1])) {
        missing.push(fileMatch[1]);
      }
    }
  }
  // Fall back to task's output_artifacts
  if (missing.length === 0 && Array.isArray(task.output_artifacts)) {
    missing.push(...task.output_artifacts);
  }
  return { missing };
}

/**
 * GATE_PARSERS — dispatch map: gate name → parser function.
 */
export const GATE_PARSERS = {
  'type-check': (output, task) => parseTypeCheckOutput(output),
  'tests-pass': (output, task) => parseTestsPassOutput(output),
  'schema-valid': (output, task) => parseSchemaValidOutput(output),
  'no-syntax-error': (output, task) => parseSyntaxErrorOutput(output),
  'output-exists': (output, task) => parseOutputExistsOutput(output, task),
};

/**
 * formatParsedOutput(gate, parsed) → string
 * Converts structured parsed data into a human-readable string for the feedback message.
 */
export function formatParsedOutput(gate, parsed) {
  if (!parsed) return '';

  if (gate === 'type-check' && parsed.errors?.length > 0) {
    return parsed.errors.map(e => `  ${e.file}:${e.line} [${e.code}] ${e.message}`).join('\n');
  }
  if (gate === 'tests-pass' && parsed.failures?.length > 0) {
    return parsed.failures.map(f => {
      let s = `  FAIL: ${f.name}`;
      if (f.expected) s += `\n    Expected: ${f.expected}`;
      if (f.actual) s += `\n    Received: ${f.actual}`;
      return s;
    }).join('\n');
  }
  if (gate === 'schema-valid' && parsed.errors?.length > 0) {
    return parsed.errors.map(e => `  - ${e}`).join('\n');
  }
  if (gate === 'no-syntax-error' && parsed.errors?.length > 0) {
    return parsed.errors.map(e => `  ${e.file}:${e.line}`).join('\n');
  }
  if (gate === 'output-exists' && parsed.missing?.length > 0) {
    return `  Missing files:\n${parsed.missing.map(f => `    - ${f}`).join('\n')}`;
  }

  return '';
}

// ── Learning opportunity detector ─────────────────────────────────────────────

const ITERATION_THRESHOLD = 3;
const EXCEPTIONAL_IMPROVEMENT_RATIO = 0.5;

/**
 * detectLearningOpportunity(gateResult, iterationCount, prevDurationMs?) → trigger | null
 *
 * Trigger types:
 *   'gate_failure'          — gate failed this iteration
 *   'excessive_iterations'  — exceeded iteration threshold
 *   'review_rejection'      — reviewer changed strategy (iterationCount > 0)
 *   'exceptional_improvement' — duration dropped > 50% (prevDurationMs provided)
 */
export function detectLearningOpportunity(gateResult, iterationCount = 0, prevDurationMs = null) {
  if (!gateResult || gateResult.passed) return null;

  // Check iteration threshold first (highest priority)
  if (iterationCount >= ITERATION_THRESHOLD) {
    return 'excessive_iterations';
  }

  // Exceptional improvement: current duration is 50%+ faster than previous
  if (prevDurationMs !== null && gateResult.durationMs > 0) {
    const ratio = gateResult.durationMs / prevDurationMs;
    if (ratio <= EXCEPTIONAL_IMPROVEMENT_RATIO) {
      return 'exceptional_improvement';
    }
  }

  // Review rejection: reviewer required changes on a retry
  if (iterationCount > 0 && gateResult.gate === 'review_rejection') {
    return 'review_rejection';
  }

  // Basic gate failure
  if (!gateResult.passed) {
    return 'gate_failure';
  }

  return null;
}

// ── Feedback record storage ───────────────────────────────────────────────────

function feedbackDir(root, taskId) {
  return join(getGateFeedbackDir(root), taskId);
}

/**
 * createFeedbackRecord(root, taskId, gateResult, feedback) → FeedbackRecord
 * Saves feedback to .ogu/gate-feedback/{taskId}/{recordId}.json
 */
export function createFeedbackRecord(root, taskId, gateResult, feedback) {
  const dir = feedbackDir(root, taskId);
  mkdirSync(dir, { recursive: true });

  const record = {
    recordId: randomUUID(),
    taskId,
    gate: gateResult?.gate || 'unknown',
    gateResult,
    feedback,
    createdAt: new Date().toISOString(),
    processed: false,
  };

  writeFileSync(
    join(dir, `${record.recordId}.json`),
    JSON.stringify(record, null, 2),
    'utf-8',
  );

  return record;
}

/**
 * listFeedbackRecords(root, taskId) → FeedbackRecord[]
 */
export function listFeedbackRecords(root, taskId) {
  const dir = feedbackDir(root, taskId);
  if (!existsSync(dir)) return [];

  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
  } catch {
    return [];
  }
}

/**
 * clearFeedbackRecords(root, taskId) → void
 * Removes all feedback records for a task (after successful retry).
 */
export function clearFeedbackRecords(root, taskId) {
  const dir = feedbackDir(root, taskId);
  if (!existsSync(dir)) return;

  try {
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      unlinkSync(join(dir, f));
    }
  } catch { /* best-effort */ }
}

// ── Retry with feedback ───────────────────────────────────────────────────────

/**
 * retryWithFeedback(root, taskId, featureSlug, gateResult, opts) → RetryResult
 *
 * Builds feedback message, saves record, and re-runs the task via executeAgentTaskCore
 * with the feedback appended to the fix note.
 *
 * opts:
 *   task         — EnrichedTask (for context)
 *   simulate     — pass through to executor
 *   maxIterations — default 3
 *   iterationCount — current iteration count
 */
export async function retryWithFeedback(root, taskId, featureSlug, gateResult, opts = {}) {
  const {
    task = {},
    simulate = false,
    maxIterations = ITERATION_THRESHOLD,
    iterationCount = 0,
  } = opts;

  // Build structured feedback
  const feedback = buildGateFeedback(gateResult, task);

  // Save feedback record
  const record = createFeedbackRecord(root, taskId, gateResult, feedback);

  // Check learning opportunity
  const learningTrigger = detectLearningOpportunity(gateResult, iterationCount);

  // Hard stop: exceeded max iterations
  if (iterationCount >= maxIterations) {
    return {
      success: false,
      stopped: true,
      reason: 'max_iterations_exceeded',
      iterationCount,
      recordId: record.recordId,
      learningTrigger,
    };
  }

  // Re-run task with feedback as fixNote
  let result;
  try {
    result = await executeAgentTaskCore(root, {
      featureSlug,
      taskId,
      roleId: task.owner_role || null,
      simulate,
      taskSpec: task,
      fixNote: feedback.message,
    });
  } catch (err) {
    return {
      success: false,
      stopped: false,
      iterationCount: iterationCount + 1,
      recordId: record.recordId,
      learningTrigger,
      result: { success: false, status: 'executor_error', error: err.message },
    };
  }

  // Clear feedback records on success
  if (result.success) {
    clearFeedbackRecords(root, taskId);
  }

  return {
    success: result.success,
    stopped: false,
    iterationCount: iterationCount + 1,
    recordId: record.recordId,
    learningTrigger,
    result,
  };
}
