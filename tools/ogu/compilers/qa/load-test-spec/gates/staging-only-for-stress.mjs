import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA045 — staging-only-for-stress
 * Stress, spike, soak, and breakpoint tests must NOT target production.
 *
 * These test types push systems beyond normal operating capacity, potentially
 * causing real outages, data corruption, or cost spikes in production.
 *
 * - type: "stress"      — ramps beyond expected capacity
 * - type: "spike"       — sudden extreme load (10–100x normal)
 * - type: "soak"        — sustained load for hours (finds memory leaks)
 * - type: "breakpoint"  — intentionally finds the breaking point
 *
 * targetEnvironment must be one of: staging, dev, test, local, canary, preview
 * Production environments: production, prod, live, main, www
 *
 * Smoke and load tests may target production if explicitly configured.
 */

const STRESS_TYPES = new Set(['stress', 'spike', 'soak', 'breakpoint']);
const PROD_ENVS = new Set(['production', 'prod', 'live', 'main', 'www', 'release']);

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'load-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA045', message: 'load-test-spec.json not readable' }; }

  const env = (spec.targetEnvironment ?? '').toLowerCase();
  const isProductionEnv = PROD_ENVS.has(env) || env.includes('prod') || env.includes('live');

  const stressScenarios = (spec.scenarios ?? []).filter(s => STRESS_TYPES.has(s.type));
  if (stressScenarios.length === 0) {
    return { pass: true, code: 'QA045', message: 'No stress/spike/soak/breakpoint scenarios — skipped', skipped: true };
  }

  if (isProductionEnv) {
    return {
      pass: false, code: 'QA045',
      message: `targetEnvironment "${spec.targetEnvironment}" is production — stress tests forbidden`,
      detail: `Scenarios: ${stressScenarios.map(s => `${s.id} (${s.type})`).join(', ')}\n\nSet targetEnvironment to "staging" or "dev". Stress tests can cause real outages in production.`,
    };
  }

  // Check for per-scenario environment overrides
  const prodOverrides = stressScenarios.filter(s => {
    const senv = (s.targetEnvironment ?? '').toLowerCase();
    return senv && (PROD_ENVS.has(senv) || senv.includes('prod') || senv.includes('live'));
  });

  if (prodOverrides.length) {
    return {
      pass: false, code: 'QA045',
      message: `${prodOverrides.length} stress scenario(s) override targetEnvironment to production`,
      detail: prodOverrides.map(s => `"${s.id}" (type: ${s.type}): targetEnvironment="${s.targetEnvironment}"`).join('\n'),
    };
  }

  return {
    pass: true, code: 'QA045',
    message: `${stressScenarios.length} stress scenario(s) targeting "${spec.targetEnvironment}" — safe`,
  };
}
