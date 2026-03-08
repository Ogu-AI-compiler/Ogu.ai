/**
 * Gate: rto-rpo-defined (DR002)
 * Validates RTO (Recovery Time Objective) and RPO (Recovery Point Objective)
 * using ISO 8601 duration format. Also checks that RPO does not exceed RTO
 * (losing more data than the recovery window is inconsistent) and warns if
 * RTO exceeds 24 hours without explicit acknowledgment.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// Parse ISO 8601 duration to minutes
function parseISO(d) {
  if (!d) return null;
  const m = d.match(/^PT?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  return (parseInt(m[1] || 0) * 60) + parseInt(m[2] || 0) + (parseInt(m[3] || 0) / 60);
}

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'dr-runbook-spec.json'), 'utf8'));
  const violations = [];

  const rto = parseISO(spec.rto);
  const rpo = parseISO(spec.rpo);

  if (rto === null) violations.push({ field: 'rto', received: spec.rto, reason: 'rto is not a valid ISO 8601 duration', hint: 'Use format like PT4H (4 hours) or PT30M (30 minutes)' });
  if (rpo === null) violations.push({ field: 'rpo', received: spec.rpo, reason: 'rpo is not a valid ISO 8601 duration', hint: 'Use format like PT1H (1 hour) or PT15M (15 minutes)' });

  if (rto !== null && rpo !== null && rpo > rto) {
    violations.push({ field: 'rto/rpo', reason: `rpo (${spec.rpo}) exceeds rto (${spec.rto}) — losing more data than the recovery window is operationally inconsistent`, hint: 'RPO should be ≤ RTO' });
  }
  if (rto !== null && rto > 24 * 60 && !spec.skipRTOWarning) {
    violations.push({ field: 'rto', received: spec.rto, reason: 'rto exceeds 24 hours — extended recovery windows require explicit acknowledgment', hint: 'Set skipRTOWarning: true if a recovery time over 24h is intentional and approved' });
  }

  if (violations.length) {
    return {
      pass: false, code: 'DR002',
      message: `${violations.length} RTO/RPO issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DR002', message: `RTO: ${spec.rto}, RPO: ${spec.rpo}` };
}
