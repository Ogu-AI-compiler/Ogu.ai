import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA031 — no-fid-metric
 * FID (First Input Delay) was replaced by INP (Interaction to Next Paint)
 * as a Core Web Vital in March 2024. Using FID means the spec is outdated
 * and the team is measuring the wrong thing.
 *
 * FID measured only the first interaction. INP measures ALL interactions
 * throughout the page lifecycle — a much more complete picture.
 *
 * Also checks: INP threshold is declared if spec.coreWebVitals is present.
 */

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'performance-budget-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA031', message: 'performance-budget-spec.json not readable' }; }

  const cwv = spec.coreWebVitals || {};

  if ('FID' in cwv) {
    return {
      pass: false, code: 'QA031',
      message: 'FID (First Input Delay) is declared — deprecated in March 2024',
      detail: `FID was replaced by INP (Interaction to Next Paint) as a Core Web Vital.\n\nRemove FID and add:\n  "INP": { "good": 200, "needsImprovement": 500 }\n\nINP measures ALL interactions (not just the first), making it a better responsiveness metric.`,
    };
  }

  // Warn if INP is also missing (suggest adding it)
  if (!('INP' in cwv)) {
    return {
      pass: false, code: 'QA031',
      message: 'INP (Interaction to Next Paint) not declared — the 2024 Core Web Vital replacement for FID',
      detail: `Add to coreWebVitals:\n  "INP": { "good": 200, "needsImprovement": 500 }`,
    };
  }

  return { pass: true, code: 'QA031', message: `INP declared — good: ${cwv.INP?.good}ms (FID correctly absent)` };
}
