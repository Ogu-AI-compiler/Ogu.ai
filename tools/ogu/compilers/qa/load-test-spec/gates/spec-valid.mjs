import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA040 — spec-valid
 * load-test-spec.json must declare:
 *   - scenarios: non-empty array, each with id, name, type, vus (virtual users), duration
 *   - targetEnvironment: string
 *   - project: string
 *
 * Valid scenario types: smoke, load, stress, spike, soak, breakpoint
 */

const VALID_TYPES = new Set(['smoke', 'load', 'stress', 'spike', 'soak', 'breakpoint']);
const DURATION_RE = /^\d+[smh]$/; // e.g. 30s, 5m, 1h

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'load-test-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA040', message: 'load-test-spec.json not found or not valid JSON' }; }

  if (!spec.project || typeof spec.project !== 'string') {
    return { pass: false, code: 'QA040', message: 'spec.project is required (string)' };
  }

  if (!spec.targetEnvironment || typeof spec.targetEnvironment !== 'string') {
    return { pass: false, code: 'QA040', message: 'spec.targetEnvironment is required (e.g. "staging", "production")' };
  }

  if (!Array.isArray(spec.scenarios) || spec.scenarios.length === 0) {
    return { pass: false, code: 'QA040', message: 'spec.scenarios must be a non-empty array' };
  }

  const errors = [];
  for (const [i, s] of spec.scenarios.entries()) {
    const ref = `scenarios[${i}] (id: ${s.id ?? 'unknown'})`;
    if (!s.id || typeof s.id !== 'string') errors.push(`${ref}: id required`);
    if (!s.name || typeof s.name !== 'string') errors.push(`${ref}: name required`);
    if (!VALID_TYPES.has(s.type)) errors.push(`${ref}: type must be one of ${[...VALID_TYPES].join(', ')}, got "${s.type}"`);
    if (typeof s.vus !== 'number' || s.vus < 1) errors.push(`${ref}: vus must be a positive integer`);
    if (!s.duration || !DURATION_RE.test(s.duration)) errors.push(`${ref}: duration must match pattern NNs/NNm/NNh (e.g. "30s", "5m")`);
  }

  if (errors.length) {
    return {
      pass: false, code: 'QA040',
      message: `${errors.length} scenario validation error(s)`,
      detail: errors.join('\n'),
    };
  }

  return {
    pass: true, code: 'QA040',
    message: `Spec valid — ${spec.scenarios.length} scenario(s), target: ${spec.targetEnvironment}`,
  };
}
