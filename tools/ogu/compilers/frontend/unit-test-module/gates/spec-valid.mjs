import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'unit-test-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'UT001', message: 'unit-test-spec.json not found' };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return { pass: false, code: 'UT001', message: 'unit-test-spec.json is invalid JSON' }; }

  const required = ['component', 'coverage_target', 'test_scenarios'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'UT001', message: `unit-test-spec.json missing: ${missing.join(', ')}` };

  if (!Array.isArray(spec.test_scenarios) || !spec.test_scenarios.length) {
    return { pass: false, code: 'UT001', message: 'test_scenarios must be a non-empty array' };
  }

  if (typeof spec.coverage_target !== 'number' || spec.coverage_target < 60 || spec.coverage_target > 100) {
    return { pass: false, code: 'UT001', message: 'coverage_target must be a number between 60 and 100' };
  }

  return { pass: true, code: 'UT001', message: `Spec valid: ${spec.test_scenarios.length} scenarios, ${spec.coverage_target}% coverage target` };
}
