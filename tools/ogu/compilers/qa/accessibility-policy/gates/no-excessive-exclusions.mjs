import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA073 — no-excessive-exclusions
 * The number of excluded elements/rules must not exceed reasonable limits.
 *
 * CSS selector exclusions and rule disablement are legitimate tools for:
 *   - Third-party widgets with known issues
 *   - Legacy content not under team control
 *   - Known false positives in automated tools
 *
 * They become problematic when overused to hide real violations:
 *   - More than 10 excluded elements suggests systematic exclusion
 *   - More than 5 disabled rules suggests the policy is being gutted
 *   - Excluding broad selectors like "div", "section", "main" is suspicious
 *
 * Thresholds:
 *   spec.exclude[]: max 10 CSS selectors
 *   spec.disabledRules[]: max 5 rule IDs
 *   No broad/dangerous selectors (single-element, very short class names)
 */

const MAX_EXCLUSIONS = 10;
const MAX_DISABLED_RULES = 5;

// Broad selectors that likely mask real violations
const DANGEROUS_SELECTORS = new Set([
  'body', 'html', 'main', 'section', 'article', 'div', 'span', 'header', 'footer', 'nav', '*',
]);

function isBroadSelector(sel) {
  const s = sel.trim().toLowerCase();
  if (DANGEROUS_SELECTORS.has(s)) return true;
  // Very short class names like '.a', '.b' — probably wildcarding
  if (/^\.[a-z]{1,2}$/i.test(s)) return true;
  return false;
}

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'accessibility-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA073', message: 'accessibility-policy-spec.json not readable' }; }

  const exclusions = spec.exclude ?? spec.excludeSelectors ?? [];
  const disabledRules = spec.disabledRules ?? spec.disableRules ?? [];
  const violations = [];

  if (!Array.isArray(exclusions)) {
    violations.push('spec.exclude must be an array of CSS selectors');
  } else {
    if (exclusions.length > MAX_EXCLUSIONS) {
      violations.push(`${exclusions.length} excluded selectors exceeds limit of ${MAX_EXCLUSIONS} — likely masking real violations`);
    }
    const broad = exclusions.filter(isBroadSelector);
    if (broad.length > 0) {
      violations.push(`Broad/dangerous selectors found: ${broad.join(', ')} — these may exclude critical accessibility checks`);
    }
  }

  if (!Array.isArray(disabledRules)) {
    violations.push('spec.disabledRules must be an array of rule IDs');
  } else if (disabledRules.length > MAX_DISABLED_RULES) {
    violations.push(`${disabledRules.length} disabled rules exceeds limit of ${MAX_DISABLED_RULES} — see QA075 for justification requirements`);
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA073',
      message: `${violations.length} excessive exclusion issue(s)`,
      detail: violations.join('\n'),
    };
  }

  const exStr = exclusions.length > 0 ? `, ${exclusions.length} exclusion(s)` : '';
  const rulesStr = disabledRules.length > 0 ? `, ${disabledRules.length} disabled rule(s)` : '';
  return {
    pass: true, code: 'QA073',
    message: `Exclusion counts within limits${exStr}${rulesStr}`,
  };
}
