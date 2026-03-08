/**
 * Gate UFF007 — abandoned-handling
 * If spec has `steps` array with length > 1, spec must declare:
 * - abandonedBehavior: "save-draft" | "discard" | "warn-then-discard"
 * Escape hatch: spec.noAbandonmentHandling = true (for single-screen forms or explicit opt-out)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_BEHAVIORS = new Set(['save-draft', 'discard', 'warn-then-discard']);

export async function run({ dir }) {
  const specPath = join(dir, 'form-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UFF007',
      message: 'form-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UFF007',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  // Escape hatch
  if (spec.noAbandonmentHandling === true) {
    return {
      pass: true,
      code: 'UFF007',
      message: 'abandoned-handling: noAbandonmentHandling=true — gate skipped',
      skipped: true,
    };
  }

  // Gate only applies to multi-step forms
  if (!Array.isArray(spec.steps) || spec.steps.length <= 1) {
    return {
      pass: true,
      code: 'UFF007',
      message: 'abandoned-handling: single-step or no steps — gate not applicable',
      skipped: true,
    };
  }

  if (typeof spec.abandonedBehavior !== 'string') {
    return {
      pass: false,
      code: 'UFF007',
      message: 'Multi-step form missing abandonedBehavior declaration',
      detail:
        'Declare abandonedBehavior as "save-draft", "discard", or "warn-then-discard". ' +
        'Users who navigate away from a multi-step form must experience a defined behavior.',
    };
  }

  if (!VALID_BEHAVIORS.has(spec.abandonedBehavior)) {
    return {
      pass: false,
      code: 'UFF007',
      message: `abandonedBehavior="${spec.abandonedBehavior}" is invalid`,
      detail: `Must be one of: ${[...VALID_BEHAVIORS].join(', ')}`,
    };
  }

  return {
    pass: true,
    code: 'UFF007',
    message: `abandoned-handling: abandonedBehavior="${spec.abandonedBehavior}"`,
  };
}
