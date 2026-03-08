/**
 * Gate UFF004 — multi-step-progress
 * If spec has `steps` array with length > 1, each step must declare
 * progressIndicator:true OR spec must have globalProgressIndicator:true.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'form-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UFF004',
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
      code: 'UFF004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  // Gate only applies when there are multiple steps
  if (!Array.isArray(spec.steps) || spec.steps.length <= 1) {
    return {
      pass: true,
      code: 'UFF004',
      message: 'multi-step-progress: single-step or no-step form — gate not applicable',
      skipped: true,
    };
  }

  // Global override satisfies all steps
  if (spec.globalProgressIndicator === true) {
    return {
      pass: true,
      code: 'UFF004',
      message: `multi-step-progress: globalProgressIndicator=true covers all ${spec.steps.length} step(s)`,
    };
  }

  const violations = [];

  spec.steps.forEach((step, i) => {
    if (step.progressIndicator !== true) {
      const stepLabel = `steps[${i}](id="${step.id ?? 'unknown'}")`;
      violations.push(
        `${stepLabel} missing progressIndicator:true — multi-step forms require progress tracking on each step`
      );
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UFF004',
      message: `${violations.length} step(s) missing progress indicator`,
      detail:
        violations.join('\n') +
        '\nFix: set progressIndicator:true on each step, or set globalProgressIndicator:true on the spec.',
    };
  }

  return {
    pass: true,
    code: 'UFF004',
    message: `multi-step-progress: all ${spec.steps.length} step(s) declare progressIndicator`,
  };
}
