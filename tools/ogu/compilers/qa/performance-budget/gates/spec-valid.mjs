import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/** QA030 — spec-valid */

export async function run({ dir }) {
  const specPath = join(dir, 'performance-budget-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'QA030', message: 'performance-budget-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch (e) { return { pass: false, code: 'QA030', message: `Invalid JSON: ${e.message}` }; }
  if (!spec.coreWebVitals || typeof spec.coreWebVitals !== 'object') {
    return { pass: false, code: 'QA030', message: 'coreWebVitals not declared' };
  }
  if (!spec.ciAction) {
    return { pass: false, code: 'QA030', message: 'ciAction not declared — must be "fail" or "warn"' };
  }
  const cwv = spec.coreWebVitals;
  if (!cwv.LCP || !cwv.CLS) {
    return { pass: false, code: 'QA030', message: 'coreWebVitals must include at least LCP and CLS' };
  }
  return { pass: true, code: 'QA030', message: `Spec valid — LCP.good: ${cwv.LCP?.good}ms, CLS.good: ${cwv.CLS?.good}` };
}
