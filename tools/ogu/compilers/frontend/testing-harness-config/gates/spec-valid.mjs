import { readFileSync, existsSync } from 'fs'; import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'test-harness-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'TC001', message: 'test-harness-spec.json not found' };
  let spec; try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch { return { pass: false, code: 'TC001', message: 'test-harness-spec.json is invalid JSON' }; }
  const required = ['runner', 'coverage_threshold', 'test_environment'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'TC001', message: `test-harness-spec.json missing: ${missing.join(', ')}` };
  if (!['vitest', 'jest'].includes(spec.runner)) return { pass: false, code: 'TC001', message: `runner must be 'vitest' or 'jest', got: ${spec.runner}` };
  return { pass: true, code: 'TC001', message: `Spec valid: ${spec.runner}, ${spec.coverage_threshold}% coverage threshold` };
}
