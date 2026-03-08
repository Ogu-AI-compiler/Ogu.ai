/**
 * Gate UDA005 — risk-classified
 * Every action's riskLevel must be: "low" | "medium" | "high" | "critical"
 * Critical actions must also declare `requiresTextConfirmation: true`
 * (user types a phrase to confirm).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical']);

export async function run({ dir }) {
  const specPath = join(dir, 'destructive-action-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDA005',
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
      code: 'UDA005',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.actions) || spec.actions.length === 0) {
    return {
      pass: true,
      code: 'UDA005',
      message: 'No actions to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const action of spec.actions) {
    const label = `action(id="${action.id ?? 'unknown'}")`;
    const riskLevel = action.riskLevel;

    // riskLevel must be a valid enum value
    if (typeof riskLevel !== 'string' || !VALID_RISK_LEVELS.has(riskLevel)) {
      violations.push(
        `${label} riskLevel="${riskLevel}" is invalid — ` +
        `must be one of: ${[...VALID_RISK_LEVELS].join(', ')}`
      );
      continue;
    }

    // Critical actions must require text confirmation
    if (riskLevel === 'critical' && action.requiresTextConfirmation !== true) {
      violations.push(
        `${label} riskLevel="critical" but requiresTextConfirmation:true is not declared — ` +
        'critical actions must require the user to type a confirmation phrase'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDA005',
      message: `${violations.length} risk classification violation(s)`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'UDA005',
    message: 'risk-classified: all actions have valid riskLevel; critical actions require text confirmation',
  };
}
