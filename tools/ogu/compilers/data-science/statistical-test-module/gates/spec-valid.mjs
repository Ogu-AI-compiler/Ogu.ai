import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * ST001 — spec-valid
 * Validates that statistical-test-spec.json exists with hypotheses and alpha level.
 *
 * Why:
 * - Hypotheses must be declared BEFORE testing, not after. Declaring H0 and H1
 *   in a machine-readable spec before running tests prevents HARKing
 *   (Hypothesizing After Results are Known) — a primary cause of the
 *   replication crisis in statistical research.
 * - The alpha level must be committed to before seeing results: choosing
 *   α=0.05 vs α=0.01 after seeing p=0.04 is post-hoc cherry-picking.
 * - Declaring test_type ensures the test selection justification gate has
 *   a baseline to compare against.
 *
 * Escape hatch: none — all statistical tests need pre-registered hypotheses.
 */

export async function run({ dir }) {
  const specPath = join(dir, 'statistical-test-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'ST001', message: 'statistical-test-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'ST001', message: 'statistical-test-spec.json is invalid JSON' }; }

  const required = ['hypothesis_h0', 'hypothesis_h1', 'alpha', 'test_type'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return { pass: false, code: 'ST001', message: `statistical-test-spec.json missing: ${missing.join(', ')}` };
  }

  if (typeof spec.alpha !== 'number' || spec.alpha <= 0 || spec.alpha >= 1) {
    return { pass: false, code: 'ST001', message: `alpha must be between 0 and 1, got: ${spec.alpha}` };
  }

  return { pass: true, code: 'ST001', message: `Spec valid: ${spec.test_type}, α=${spec.alpha}` };
}
