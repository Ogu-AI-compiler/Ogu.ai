import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA042 — smoke-required
 * At least one scenario must be of type "smoke" (1–5 VUs, short duration).
 *
 * The smoke scenario serves as a sanity check before running full load:
 *   - Verifies the test script works end-to-end
 *   - Confirms target URLs respond correctly
 *   - Runs in CI on every PR (cheap, fast, catches broken infra)
 *
 * A test suite without a smoke scenario risks running heavy load tests
 * against a broken environment, wasting time and potentially triggering
 * cascading failures in staging.
 *
 * Smoke scenario constraints:
 *   - type: "smoke"
 *   - vus: ≤ 5
 *   - duration: ≤ 2m (120 seconds)
 */

const SMOKE_MAX_VUS = 5;
const SMOKE_MAX_SECONDS = 120;

function durationToSeconds(d) {
  if (!d) return Infinity;
  const n = parseInt(d, 10);
  if (d.endsWith('s')) return n;
  if (d.endsWith('m')) return n * 60;
  if (d.endsWith('h')) return n * 3600;
  return Infinity;
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'load-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA042', message: 'load-test-spec.json not readable' }; }

  const smokes = (spec.scenarios ?? []).filter(s => s.type === 'smoke');

  if (smokes.length === 0) {
    return {
      pass: false, code: 'QA042',
      message: 'No smoke scenario declared — at least one type: "smoke" scenario is required',
      detail: 'A smoke scenario (≤5 VUs, ≤2m) validates the test script before full load runs. Add:\n  { "id": "smoke", "type": "smoke", "vus": 1, "duration": "30s" }',
    };
  }

  const violations = [];
  for (const s of smokes) {
    if (typeof s.vus === 'number' && s.vus > SMOKE_MAX_VUS) {
      violations.push(`Scenario "${s.id}": vus=${s.vus} exceeds smoke maximum of ${SMOKE_MAX_VUS}`);
    }
    const secs = durationToSeconds(s.duration);
    if (secs > SMOKE_MAX_SECONDS) {
      violations.push(`Scenario "${s.id}": duration=${s.duration} exceeds smoke maximum of ${SMOKE_MAX_SECONDS}s`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA042',
      message: `Smoke scenario(s) exceed limits — smoke must be lightweight`,
      detail: violations.join('\n'),
    };
  }

  return { pass: true, code: 'QA042', message: `${smokes.length} smoke scenario(s) declared and valid` };
}
