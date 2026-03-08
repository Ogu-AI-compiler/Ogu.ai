/**
 * Gate UDA006 — recovery-link
 * Every action with riskLevel "high" or "critical" must declare `recoveryPath`
 * (string — a screen id or URL) for the case where undo window has passed.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const REQUIRES_RECOVERY = new Set(['high', 'critical']);

export async function run({ dir }) {
  const specPath = join(dir, 'destructive-action-spec.json');

  if (!existsSync(specPath)) {
    return {
      pass: true,
      code: 'UDA006',
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
      code: 'UDA006',
      message: 'parse error handled by spec-valid — skipped',
      skipped: true,
    };
  }

  if (!Array.isArray(spec.actions) || spec.actions.length === 0) {
    return {
      pass: true,
      code: 'UDA006',
      message: 'No actions to check — gate skipped',
      skipped: true,
    };
  }

  const violations = [];

  for (const action of spec.actions) {
    if (!REQUIRES_RECOVERY.has(action.riskLevel)) continue;

    const label = `action(id="${action.id ?? 'unknown'}", riskLevel="${action.riskLevel}")`;

    const hasRecoveryPath =
      typeof action.recoveryPath === 'string' && action.recoveryPath.trim() !== '';

    if (!hasRecoveryPath) {
      violations.push(
        `${label} missing recoveryPath — high/critical actions must declare ` +
        'a recovery screen or URL for when the undo window has passed'
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UDA006',
      message: `${violations.length} high/critical action(s) missing recoveryPath`,
      detail: violations.join('\n'),
    };
  }

  const highRiskCount = spec.actions.filter(a => REQUIRES_RECOVERY.has(a.riskLevel)).length;
  return {
    pass: true,
    code: 'UDA006',
    message: `recovery-link: all ${highRiskCount} high/critical action(s) declare recoveryPath`,
  };
}
