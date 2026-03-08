/**
 * Gate UDA004 — no-auto-confirm
 * No action may have `autoConfirm: true`.
 * Auto-confirmation bypasses user intent — always a violation, no escape hatch.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'destructive-action-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDA004',
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
      code: 'UDA004',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.actions) || spec.actions.length === 0) {
    return {
      pass: true,
      code: 'UDA004',
      message: 'No actions to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const action of spec.actions) {
    if (action.autoConfirm === true) {
      violations.push(
        `action(id="${action.id ?? 'unknown'}", riskLevel="${action.riskLevel ?? 'unknown'}") ` +
        'has autoConfirm:true — auto-confirmation bypasses user intent and is always forbidden'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDA004',
      message: `${violations.length} action(s) with forbidden autoConfirm:true`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UDA004',
    message: 'no-auto-confirm: no actions use autoConfirm:true',
  };
}
