/**
 * Gate UDA002 — confirmation-required
 * Every action must have a `confirmation` object with at minimum `message` (string).
 * Escape hatch: action.confirmationNotRequired = true — only valid when riskLevel is "low".
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'destructive-action-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDA002',
      message: 'destructive-action-spec.json not found — gate skipped',
      skipped: true,
    };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return {
      pass: true,
      code: 'UDA002',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.actions) || spec.actions.length === 0) {
    return {
      pass: true,
      code: 'UDA002',
      message: 'No actions to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const action of spec.actions) {
    const label = `action(id="${action.id ?? 'unknown'}")`;

    // Escape hatch only valid for "low" risk actions
    if (action.confirmationNotRequired === true) {
      if (action.riskLevel !== 'low') {
        violations.push(
          `${label} has confirmationNotRequired:true but riskLevel="${action.riskLevel}" — ` +
          'this escape hatch is only allowed for riskLevel="low"'
        );
      }
      continue;
    }

    // Must have confirmation object
    if (typeof action.confirmation !== 'object' || action.confirmation === null) {
      violations.push(
        `${label} missing confirmation object — every destructive action needs user confirmation`
      );
      continue;
    }

    // confirmation.message must be a non-empty string
    if (
      typeof action.confirmation.message !== 'string' ||
      action.confirmation.message.trim() === ''
    ) {
      violations.push(
        `${label} confirmation.message missing or empty — ` +
        'the confirmation dialog must have a message to display to the user'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDA002',
      message: `${violations.length} action(s) missing required confirmation`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UDA002',
    message: 'confirmation-required: all actions have confirmation with message',
  };
}
