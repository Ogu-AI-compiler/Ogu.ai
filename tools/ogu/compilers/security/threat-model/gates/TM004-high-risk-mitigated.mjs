import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TM004 — high-risk-mitigated: threats with risk score >= 15 must have at least one mitigation */
export async function run({ dir }) {
  const specPath = join(dir, 'threat-model.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'TM004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TM004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.threats) || spec.threats.length === 0) {
    return { pass: true, code: 'TM004', message: 'No threats — gate skipped', skipped: true };
  }

  const HIGH_RISK_THRESHOLD = 15;
  const violations = [];

  for (const threat of spec.threats) {
    const id = threat.id || '?';
    const likelihood = typeof threat.likelihood === 'number' ? threat.likelihood : 0;
    const impact = typeof threat.impact === 'number' ? threat.impact : 0;
    const riskScore = threat.risk_score !== undefined ? threat.risk_score : likelihood * impact;

    if (riskScore < HIGH_RISK_THRESHOLD) continue;

    // Must have mitigations
    const hasMitigations = Array.isArray(threat.mitigations) && threat.mitigations.length > 0;
    const hasWaiverRef = typeof threat.waiver_ref === 'string' && threat.waiver_ref.trim().length > 0;

    if (!hasMitigations && !hasWaiverRef) {
      violations.push(`Threat "${id}" (risk score: ${riskScore}): high-risk threat has no mitigations and no waiver_ref — all threats with risk score ≥ ${HIGH_RISK_THRESHOLD} must be mitigated or waived`);
      continue;
    }

    // If mitigations are declared, each must have a description
    if (hasMitigations) {
      threat.mitigations.forEach((m, mi) => {
        if (!m.description || typeof m.description !== 'string' || m.description.trim().length < 5) {
          violations.push(`Threat "${id}", mitigation[${mi}]: description must be a meaningful string (not empty or trivially short)`);
        }
      });
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'TM004',
      message: `${violations.length} high-risk threat(s) are unmitigated`,
      detail: violations.join('\n'),
    };
  }

  const highRiskCount = spec.threats.filter(t => {
    const l = typeof t.likelihood === 'number' ? t.likelihood : 0;
    const i = typeof t.impact === 'number' ? t.impact : 0;
    return (t.risk_score !== undefined ? t.risk_score : l * i) >= HIGH_RISK_THRESHOLD;
  }).length;

  return { pass: true, code: 'TM004', message: `All ${highRiskCount} high-risk threat(s) are mitigated or waived` };
}
