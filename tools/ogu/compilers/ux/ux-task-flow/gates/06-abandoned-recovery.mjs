/**
 * Gate UTK006 — abandoned-recovery
 * If spec.abandonable = true, spec must declare:
 *   - resumeFrom (string step id), OR
 *   - recovery_entry (string)
 * Escape hatch: spec.abandonmentNotApplicable = true skips this gate.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'task-flow-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UTK006',
      message: 'task-flow-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UTK006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  // Escape hatch: explicitly marked as not applicable
  if (spec.abandonmentNotApplicable === true) {
    return {
      pass: true,
      code: 'UTK006',
      message: 'abandoned-recovery: abandonmentNotApplicable=true — gate skipped',
      skipped: true,
    };
  }

  // Gate only applies when abandonable:true
  if (spec.abandonable !== true) {
    return {
      pass: true,
      code: 'UTK006',
      message: 'abandoned-recovery: spec.abandonable not set — gate not applicable',
      skipped: true,
    };
  }

  const hasResumeFrom =
    typeof spec.resumeFrom === 'string' && spec.resumeFrom.trim() !== '';
  const hasRecoveryEntry =
    typeof spec.recovery_entry === 'string' && spec.recovery_entry.trim() !== '';

  if (!hasResumeFrom && !hasRecoveryEntry) {
    return {
      pass: false,
      code: 'UTK006',
      message: 'spec.abandonable=true but no recovery declared — must declare resumeFrom or recovery_entry',
      detail:
        'When a task flow is abandonable, the user must be able to resume from a known state. ' +
        'Declare resumeFrom (string step id) or recovery_entry (string screen/route).',
    };
  }

  const declared = hasResumeFrom
    ? `resumeFrom="${spec.resumeFrom}"`
    : `recovery_entry="${spec.recovery_entry}"`;

  return {
    pass: true,
    code: 'UTK006',
    message: `abandoned-recovery: abandonable with ${declared}`,
  };
}
