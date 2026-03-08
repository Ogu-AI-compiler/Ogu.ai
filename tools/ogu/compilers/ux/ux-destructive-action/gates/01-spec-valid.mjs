/**
 * Gate UDA001 — spec-valid
 * destructive-action-spec.json must exist with:
 * - actions (array) — each action has id (string), label (string), riskLevel (string)
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'destructive-action-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDA001',
      message: 'destructive-action-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (err) {
    return {
      pass: false,
      code: 'UDA001',
      message: `destructive-action-spec.json parse error: ${err.message}`,
    };
  }

  if (!Array.isArray(spec.actions)) {
    return {
      pass: false,
      code: 'UDA001',
      message: 'destructive-action-spec.json missing required field: actions (array)',
    };
  }

  if (spec.actions.length === 0) {
    return {
      pass: false,
      code: 'UDA001',
      message: 'actions array is empty — at least one destructive action is required',
    };
  }

  const violations = [];

  spec.actions.forEach((action, i) => {
    if (typeof action.id !== 'string' || action.id.trim() === '') {
      violations.push(`actions[${i}] missing or empty field: id (string)`);
    }
    if (typeof action.label !== 'string' || action.label.trim() === '') {
      violations.push(`actions[${i}](id="${action.id ?? 'unknown'}") missing or empty field: label (string)`);
    }
    if (typeof action.riskLevel !== 'string' || action.riskLevel.trim() === '') {
      violations.push(`actions[${i}](id="${action.id ?? 'unknown'}") missing or empty field: riskLevel (string)`);
    }
  });

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDA001',
      message: `${violations.length} action(s) missing required fields`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UDA001',
    message: `spec-valid: ${spec.actions.length} destructive action(s) found`,
  };
}
