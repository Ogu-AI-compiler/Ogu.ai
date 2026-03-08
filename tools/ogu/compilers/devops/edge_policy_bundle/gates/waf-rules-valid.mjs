/**
 * Gate: waf-rules-valid (EP004)
 * Validates WAF rule configuration. Every WAF rule must have an id (for
 * auditability), a valid action (to define what happens on match), and a
 * match expression (to define what triggers the rule).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const ALLOWED_ACTIONS = new Set(['allow', 'block', 'challenge', 'log', 'redirect']);

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'edge-policy-spec.json'), 'utf8'));

  if (!spec.waf) {
    return { pass: true, code: 'EP004', message: 'No WAF config — skipping', skipped: true };
  }

  const violations = [];

  for (const rule of (spec.waf.rules || [])) {
    if (!rule.id)    violations.push({ rule: rule.id || '(no-id)', field: 'id',     reason: 'WAF rule missing id — cannot audit which rule blocked a request' });
    if (!rule.match) violations.push({ rule: rule.id || '(no-id)', field: 'match',  reason: 'WAF rule missing match expression — rule will never trigger' });
    if (!rule.action || !ALLOWED_ACTIONS.has(rule.action)) {
      violations.push({ rule: rule.id || '(no-id)', field: 'action', received: rule.action, allowed: [...ALLOWED_ACTIONS], reason: `Invalid action "${rule.action}"` });
    }
  }

  if (spec.waf.mode && !['detection', 'prevention'].includes(spec.waf.mode)) {
    violations.push({ field: 'waf.mode', received: spec.waf.mode, allowed: ['detection', 'prevention'], reason: `waf.mode "${spec.waf.mode}" must be "detection" or "prevention"` });
  }

  if (violations.length) {
    return {
      pass: false, code: 'EP004',
      message: `${violations.length} WAF rule violation(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'EP004', message: 'WAF rules valid' };
}
