import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** IV004 — high-risk-fields-have-sanitization: SQL/HTML/script-injectable fields must declare sanitization */
export async function run({ dir }) {
  const specPath = join(dir, 'input-validation-policy.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'IV004', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'IV004', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.fields)) {
    return { pass: true, code: 'IV004', message: 'No fields — gate skipped', skipped: true };
  }

  const HIGH_RISK_TYPES = new Set(['html', 'markdown', 'rich_text', 'sql', 'query', 'xpath', 'ldap', 'shell', 'script', 'template', 'url', 'redirect_url']);
  const HIGH_RISK_NAMES = ['comment', 'bio', 'description', 'body', 'content', 'note', 'message', 'search', 'query', 'filter', 'redirect', 'callback'];

  const violations = [];

  for (const field of spec.fields) {
    const id = field.id || '?';
    const type = String(field.type || '').toLowerCase();
    const name = String(field.name || field.id || '').toLowerCase();

    const isHighRisk = HIGH_RISK_TYPES.has(type) ||
      HIGH_RISK_NAMES.some(riskName => name.includes(riskName)) ||
      field.high_risk === true;

    if (!isHighRisk) continue;

    const hasSanitization = field.sanitize === true ||
      (typeof field.sanitization === 'string' && field.sanitization.length > 0) ||
      (Array.isArray(field.sanitization) && field.sanitization.length > 0);

    if (!hasSanitization) {
      violations.push(`Field "${id}" (type: ${field.type}): high-risk field must declare "sanitize: true" or "sanitization" strategy (e.g. "html-escape", "parameterized-query", "allowlist")`);
    }
  }

  if (violations.length > 0) {
    return { pass: false, code: 'IV004', message: `${violations.length} high-risk field(s) missing sanitization declaration`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'IV004', message: 'All high-risk fields declare sanitization strategy' };
}
