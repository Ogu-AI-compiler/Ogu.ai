/**
 * Gate UOF005 — abandoned-recovery
 * Spec must declare abandonedBehavior:
 * "save-progress" | "restart" | "ask-user"
 * If "save-progress", spec must also declare resumeKey (string).
 * Escape hatch: spec.singleSession = true
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_ABANDONED_BEHAVIORS = new Set(['save-progress', 'restart', 'ask-user']);

export async function run({ dir }) {
  const specPath = join(dir, 'onboarding-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UOF005',
      message: 'onboarding-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UOF005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (spec.singleSession === true) {
    return {
      pass: true,
      code: 'UOF005',
      message: 'abandoned-recovery: singleSession:true — abandonment recovery not applicable',
      skipped: true,
    };
  }

  if (typeof spec.abandonedBehavior !== 'string') {
    return {
      pass: false,
      code: 'UOF005',
      message: 'abandonedBehavior is missing — must be "save-progress", "restart", or "ask-user"',
    };
  }

  if (!VALID_ABANDONED_BEHAVIORS.has(spec.abandonedBehavior)) {
    return {
      pass: false,
      code: 'UOF005',
      message: `abandonedBehavior="${spec.abandonedBehavior}" is invalid — must be "save-progress", "restart", or "ask-user"`,
    };
  }

  if (spec.abandonedBehavior === 'save-progress') {
    if (typeof spec.resumeKey !== 'string' || spec.resumeKey.trim() === '') {
      return {
        pass: false,
        code: 'UOF005',
        message: 'abandonedBehavior="save-progress" requires resumeKey (string) to identify where progress is stored',
      };
    }
  }

  const resumeNote = spec.abandonedBehavior === 'save-progress' ? `, resumeKey="${spec.resumeKey}"` : '';

  return {
    pass: true,
    code: 'UOF005',
    message: `abandoned-recovery: abandonedBehavior="${spec.abandonedBehavior}"${resumeNote}`,
  };
}
