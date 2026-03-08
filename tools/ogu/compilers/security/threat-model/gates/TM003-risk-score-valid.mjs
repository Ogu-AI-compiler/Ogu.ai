import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** TM003 — risk-score-valid: likelihood and impact must be 1–5 integers; risk_score = likelihood × impact */
export async function run({ dir }) {
  const specPath = join(dir, 'threat-model.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'TM003', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'TM003', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.threats) || spec.threats.length === 0) {
    return { pass: true, code: 'TM003', message: 'No threats — gate skipped', skipped: true };
  }

  const violations = [];

  for (const threat of spec.threats) {
    const id = threat.id || '?';
    const likelihood = threat.likelihood;
    const impact = threat.impact;

    if (typeof likelihood !== 'number' || likelihood < 1 || likelihood > 5 || !Number.isInteger(likelihood)) {
      violations.push(`Threat "${id}": likelihood must be an integer between 1 and 5, got: ${JSON.stringify(likelihood)}`);
    }
    if (typeof impact !== 'number' || impact < 1 || impact > 5 || !Number.isInteger(impact)) {
      violations.push(`Threat "${id}": impact must be an integer between 1 and 5, got: ${JSON.stringify(impact)}`);
    }

    // If risk_score is explicitly declared, it must match likelihood × impact
    if (threat.risk_score !== undefined) {
      const expected = likelihood * impact;
      if (threat.risk_score !== expected) {
        violations.push(`Threat "${id}": risk_score=${threat.risk_score} does not match likelihood(${likelihood}) × impact(${impact}) = ${expected}`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'TM003',
      message: `${violations.length} threat(s) have invalid risk scoring`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'TM003', message: `Risk scoring valid for all ${spec.threats.length} threat(s)` };
}
