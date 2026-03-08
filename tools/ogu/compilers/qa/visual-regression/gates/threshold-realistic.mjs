import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA061 — threshold-realistic
 * diffThreshold must be between 0.001 and 0.05 (0.1%–5%).
 *
 * diffThreshold = 0 means any single pixel change fails the test.
 * This causes constant false positives due to:
 *   - Anti-aliasing differences between rendering engines
 *   - Sub-pixel font rendering on different OS versions
 *   - Slight color profile variations between CI and local
 *
 * diffThreshold > 0.05 (5%) means 5% of all pixels can change — for a
 * 1280×800 screenshot (1,024,000px), that is 51,200 changed pixels.
 * A component could be significantly shifted and still pass.
 *
 * Recommended range: 0.002–0.02 (0.2%–2%)
 * Tight: 0.001 (0.1%) — only for pixel-perfect tools with no anti-aliasing
 * Loose: 0.05 (5%) — maximum acceptable for pages with dynamic content
 */

const MIN_THRESHOLD = 0.001;
const MAX_THRESHOLD = 0.05;
const RECOMMENDED_MAX = 0.02;

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'visual-regression-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA061', message: 'visual-regression-spec.json not readable' }; }

  const threshold = spec.diffThreshold;

  if (typeof threshold !== 'number') {
    return { pass: false, code: 'QA061', message: 'diffThreshold is not a number' };
  }

  if (threshold === 0) {
    return {
      pass: false, code: 'QA061',
      message: 'diffThreshold: 0 causes constant false positives from anti-aliasing and font rendering differences',
      detail: `Set diffThreshold to at least ${MIN_THRESHOLD} (${(MIN_THRESHOLD * 100).toFixed(1)}%). Use 0.002 as a starting point.`,
    };
  }

  if (threshold < MIN_THRESHOLD) {
    return {
      pass: false, code: 'QA061',
      message: `diffThreshold: ${threshold} is below minimum ${MIN_THRESHOLD} — will cause false positives`,
      detail: 'Sub-pixel rendering differences will cause failures unrelated to actual visual changes.',
    };
  }

  if (threshold > MAX_THRESHOLD) {
    return {
      pass: false, code: 'QA061',
      message: `diffThreshold: ${threshold} (${(threshold * 100).toFixed(1)}%) exceeds maximum ${MAX_THRESHOLD} — too lenient`,
      detail: `At ${(threshold * 100).toFixed(1)}%, significant layout shifts can go undetected. Use ≤ ${(MAX_THRESHOLD * 100).toFixed(0)}%.`,
    };
  }

  const quality = threshold <= RECOMMENDED_MAX ? 'within recommended range' : 'above recommended range (consider tightening)';
  return {
    pass: true, code: 'QA061',
    message: `diffThreshold: ${threshold} (${(threshold * 100).toFixed(1)}%) — ${quality}`,
  };
}
