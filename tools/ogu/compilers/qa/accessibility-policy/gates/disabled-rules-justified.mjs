import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * QA075 — disabled-rules-justified
 * Every disabled accessibility rule must include a documented justification.
 *
 * Disabling a rule without justification is indistinguishable from ignoring
 * the problem. A justification documents:
 *   1. Why the automated check produces a false positive here
 *   2. OR why the rule is not applicable to this project
 *   3. OR what compensating manual test covers it instead
 *
 * Expected shape for each disabled rule:
 *   {
 *     "ruleId": "color-contrast",
 *     "reason": "Third-party analytics widget — vendor ticket #4521 open",
 *     "ticket": "https://github.com/vendor/widget/issues/4521",  // optional
 *     "review": "2025-06-01"  // optional: when to re-evaluate
 *   }
 *
 * If disabledRules is not declared or is empty, this gate is skipped.
 */

const MIN_REASON_LENGTH = 20;

export async function run({ dir }) {
  let spec;
  try { spec = JSON.parse(readFileSync(join(dir, 'accessibility-policy-spec.json'), 'utf8')); }
  catch { return { pass: false, code: 'QA075', message: 'accessibility-policy-spec.json not readable' }; }

  const rules = spec.disabledRules ?? spec.disableRules ?? [];

  if (!Array.isArray(rules) || rules.length === 0) {
    return { pass: true, code: 'QA075', message: 'No disabled rules — skipped', skipped: true };
  }

  const violations = [];

  for (const [i, rule] of rules.entries()) {
    const ref = `disabledRules[${i}]`;

    // String shorthand: "rule-id" — no justification
    if (typeof rule === 'string') {
      violations.push(`${ref} "${rule}": string shorthand not allowed — must be an object with ruleId and reason`);
      continue;
    }

    if (typeof rule !== 'object' || Array.isArray(rule)) {
      violations.push(`${ref}: must be an object with ruleId and reason`);
      continue;
    }

    if (!rule.ruleId || typeof rule.ruleId !== 'string') {
      violations.push(`${ref}: ruleId is required`);
    }

    if (!rule.reason || typeof rule.reason !== 'string') {
      violations.push(`${ref} "${rule.ruleId ?? 'unknown'}": reason is required`);
    } else if (rule.reason.trim().length < MIN_REASON_LENGTH) {
      violations.push(`${ref} "${rule.ruleId}": reason is too short (${rule.reason.trim().length} chars, min ${MIN_REASON_LENGTH}) — be specific`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QA075',
      message: `${violations.length} disabled rule(s) missing justification`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true, code: 'QA075',
    message: `${rules.length} disabled rule(s) all have documented justification`,
  };
}
