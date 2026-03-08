import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA071 — wcag-standard-current
 * WCAG 2.2 was published October 5, 2023. Projects must target at minimum WCAG 2.1.
 * WCAG 2.0 was published June 2008 and lacks critical criteria for modern UIs.
 *
 * Policy:
 *   - wcagVersion: "2.0" — FAIL: outdated, missing mobile, color contrast improvements
 *   - wcagVersion: "2.1" — PASS with notice (current minimum acceptable)
 *   - wcagVersion: "2.2" — PASS (current standard, recommended)
 *   - wcagLevel: "A" only — FAIL: WCAG-A alone is insufficient for public-facing apps
 *
 * Note: "AAA" is aspirational and may not be achievable for all content types.
 * "AA" is the legal/practical standard for most jurisdictions (ADA, EN 301 549, EAA).
 */

const OUTDATED_VERSIONS = new Set(['1.0', '1.1', '2.0']);
const MINIMUM_LEVEL = 'AA';

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'accessibility-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA071', message: 'accessibility-policy-spec.json not readable' }; }

  const version = String(spec.wcagVersion ?? '');
  const level = spec.wcagLevel;

  if (OUTDATED_VERSIONS.has(version)) {
    return {
      pass: false, code: 'QA071',
      message: `WCAG ${version} is outdated — minimum required: WCAG 2.1`,
      detail: `WCAG 2.0 (2008) predates mobile-first design, lacks 1.4.10 Reflow, 1.4.12 Text Spacing, and other essential criteria.\nUpgrade to: "wcagVersion": "2.1" or "2.2"`,
    };
  }

  if (level === 'A') {
    return {
      pass: false, code: 'QA071',
      message: 'wcagLevel: "A" is insufficient — Level AA is the minimum for public-facing applications',
      detail: 'WCAG Level A omits critical requirements:\n  - 1.4.3 Contrast (Minimum)\n  - 2.4.7 Focus Visible\n  - 3.3.2 Labels or Instructions\nSet "wcagLevel": "AA".',
    };
  }

  const notice = version === '2.1'
    ? ` — consider upgrading to 2.2 (adds 2.4.11 Focus Not Obscured, 2.5.7 Dragging Movements, 3.2.6 Consistent Help)`
    : '';

  return {
    pass: true, code: 'QA071',
    message: `WCAG ${version} Level ${level}${notice}`,
  };
}
