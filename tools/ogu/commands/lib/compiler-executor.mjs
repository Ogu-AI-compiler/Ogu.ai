/**
 * compiler-executor.mjs
 * Runs domain compiler gates on agent task output.
 *
 * Flow:
 *   agent completes task
 *   → compiler-executor.executeCompiler(root, role, context)
 *   → each gate in compiler.json is evaluated
 *   → result: { passed, gates, attestation }
 *   → on pass: artifact sealed via crypto-attestation
 *   → result recorded via compiler-registry.recordBenchmark
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCompiler, recordBenchmark } from './compiler-registry.mjs';
import { createAttestation } from './crypto-attestation.mjs';
import { emitAudit } from './audit-emitter.mjs';

/**
 * executeCompiler(root, role, context) → CompilerResult
 *
 * Runs all domain gates defined in the compiler for `role` against the task output.
 *
 * @param {string} root   - Project root
 * @param {string} role   - Role slug (e.g. 'qa-engineer')
 * @param {object} context
 *   @param {string}   context.taskId
 *   @param {string}   context.featureSlug
 *   @param {string}   context.agentId
 *   @param {string[]} context.outputFiles    — files written by the agent
 *   @param {object}   context.artifactStore  — key/value artifact store for this task
 *   @param {string}   [context.outputText]   — raw LLM output text (optional)
 *
 * @returns {{ passed: boolean, gates: GateResult[], attestation: object|null }}
 */
export async function executeCompiler(root, role, context) {
  const compiler = getCompiler(root, role);
  if (!compiler) {
    // No compiler registered for this role — pass through (not an error)
    return { passed: true, gates: [], attestation: null, skipped: true };
  }

  const start = Date.now();
  const gateResults = [];

  for (const gate of (compiler.gates ?? [])) {
    const result = await _evaluateGate(gate, context, root);
    gateResults.push(result);

    // Stop on first error-severity failure
    if (!result.passed && gate.severity === 'error') {
      break;
    }
  }

  const passed = gateResults.every(g => g.passed || g.severity !== 'error');
  const duration_ms = Date.now() - start;

  // Record benchmark
  recordBenchmark(root, role, {
    taskId: context.taskId,
    featureSlug: context.featureSlug,
    gates: gateResults,
    passed,
    duration_ms,
  });

  // Emit audit event
  emitAudit('compiler.executed', {
    role,
    agentId: context.agentId,
    taskId: context.taskId,
    featureSlug: context.featureSlug,
    passed,
    gate_count: gateResults.length,
    failures: gateResults.filter(g => !g.passed).map(g => g.id),
  }, { source: 'kadima', severity: passed ? 'info' : 'warn' });

  // Seal artifact on pass
  let attestation = null;
  if (passed && context.outputFiles?.length > 0) {
    const content = context.outputFiles.join('\n') + JSON.stringify(gateResults);
    attestation = createAttestation({
      type: 'compiler',
      taskId: context.taskId,
      featureSlug: context.featureSlug,
      content,
    });
  }

  return { passed, gates: gateResults, attestation, skipped: false };
}

/**
 * buildGateReport(result) → string
 * Human-readable report of gate execution results.
 */
export function buildGateReport(result) {
  if (result.skipped) return '  (no compiler registered for this role — skipped)';

  const lines = [];
  for (const g of result.gates) {
    const icon = g.passed ? '✓' : g.severity === 'error' ? '✗' : '⚠';
    lines.push(`  ${icon} [${g.id}] ${g.reason ?? ''}`);
  }
  lines.push('');
  lines.push(result.passed ? '  COMPILER PASS' : '  COMPILER FAIL');
  return lines.join('\n');
}

// ── Gate evaluators ───────────────────────────────────────────────────────────

async function _evaluateGate(gate, context, root) {
  const base = { id: gate.id, severity: gate.severity ?? 'error', passed: false, reason: '' };

  try {
    const evaluator = GATE_EVALUATORS[gate.type] ?? GATE_EVALUATORS['default'];
    const { passed, reason } = await evaluator(gate, context, root);
    return { ...base, passed, reason };
  } catch (err) {
    return { ...base, passed: false, reason: `Gate evaluation error: ${err.message}` };
  }
}

/**
 * Gate evaluators keyed by gate.type.
 *
 * Each evaluator receives (gate, context, root) and returns { passed, reason }.
 *
 * Gate types:
 *   file_exists          — checks that required output files exist
 *   file_contains        — checks file content for required strings
 *   file_not_contains    — checks file content does NOT contain banned strings
 *   output_count         — checks minimum number of output files
 *   artifact_key_exists  — checks that a key exists in artifactStore
 *   text_contains        — checks raw LLM output text for required strings
 *   text_not_contains    — checks raw LLM output for banned patterns
 *   custom               — gate.check is a JS expression string (not used in prod)
 *   default              — unknown gate type, auto-pass with warning
 */
const GATE_EVALUATORS = {

  file_exists: (gate, context, root) => {
    const { pattern } = gate;
    const files = context.outputFiles ?? [];
    const match = files.some(f => f.includes(pattern) || f.endsWith(pattern));
    return {
      passed: match,
      reason: match
        ? `Found file matching "${pattern}"`
        : `No output file matching "${pattern}"`,
    };
  },

  file_contains: (gate, context, root) => {
    const { pattern, required_string } = gate;
    const files = (context.outputFiles ?? []).filter(f =>
      !pattern || f.includes(pattern) || f.endsWith(pattern),
    );
    for (const filePath of files) {
      const fullPath = join(root, filePath);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, 'utf-8');
      if (content.includes(required_string)) {
        return { passed: true, reason: `Found "${required_string}" in ${filePath}` };
      }
    }
    return { passed: false, reason: `"${required_string}" not found in any output file` };
  },

  file_not_contains: (gate, context, root) => {
    const { pattern, banned_string } = gate;
    const files = (context.outputFiles ?? []).filter(f =>
      !pattern || f.includes(pattern) || f.endsWith(pattern),
    );
    for (const filePath of files) {
      const fullPath = join(root, filePath);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, 'utf-8');
      if (content.includes(banned_string)) {
        return { passed: false, reason: `Found banned "${banned_string}" in ${filePath}` };
      }
    }
    return { passed: true, reason: `No banned patterns found` };
  },

  output_count: (gate, context) => {
    const { min } = gate;
    const count = (context.outputFiles ?? []).length;
    return {
      passed: count >= min,
      reason: count >= min
        ? `${count} output files (min: ${min})`
        : `Only ${count} output files, need at least ${min}`,
    };
  },

  artifact_key_exists: (gate, context) => {
    const { key } = gate;
    const exists = context.artifactStore && key in context.artifactStore;
    return {
      passed: exists,
      reason: exists ? `Artifact key "${key}" found` : `Missing artifact key "${key}"`,
    };
  },

  text_contains: (gate, context) => {
    const { required_string } = gate;
    const text = context.outputText ?? '';
    const found = text.includes(required_string);
    return {
      passed: found,
      reason: found
        ? `Found "${required_string}" in output`
        : `"${required_string}" not found in agent output`,
    };
  },

  text_not_contains: (gate, context) => {
    const { banned_string } = gate;
    const text = context.outputText ?? '';
    const found = text.includes(banned_string);
    return {
      passed: !found,
      reason: !found
        ? `No banned pattern "${banned_string}" in output`
        : `Banned pattern "${banned_string}" found in output`,
    };
  },

  default: (gate) => ({
    passed: true,
    reason: `Unknown gate type "${gate.type}" — auto-pass`,
  }),
};
