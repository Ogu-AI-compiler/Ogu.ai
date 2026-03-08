import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ST002 — owasp-categories-covered: rule sets must cover core OWASP Top 10 categories */
export async function run({ dir }) {
  const specPath = join(dir, 'sast-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'ST002', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'ST002', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.rule_sets)) return { pass: true, code: 'ST002', message: 'No rule sets — gate skipped', skipped: true };

  const REQUIRED_CATEGORIES = ['injection', 'xss', 'ssrf', 'path-traversal', 'deserialization'];
  const allRuleSetText = spec.rule_sets.map(r => {
    const rStr = typeof r === 'string' ? r : (r.name || r.id || r.category || '');
    return rStr.toLowerCase();
  }).join(' ');

  const CATEGORY_ALIASES = {
    'injection': ['injection', 'sqli', 'sql-injection', 'command-injection', 'code-injection'],
    'xss': ['xss', 'cross-site-scripting', 'html-injection'],
    'ssrf': ['ssrf', 'server-side-request-forgery', 'server-request-forgery'],
    'path-traversal': ['path-traversal', 'directory-traversal', 'lfi', 'local-file-inclusion'],
    'deserialization': ['deserialization', 'unsafe-deserialization', 'object-injection'],
  };

  const violations = [];
  for (const [category, aliases] of Object.entries(CATEGORY_ALIASES)) {
    const covered = aliases.some(alias => allRuleSetText.includes(alias));
    if (!covered) {
      violations.push(`OWASP category "${category}" is not covered by any declared rule set — add a rule set with this category`);
    }
  }

  if (violations.length > 0) return { pass: false, code: 'ST002', message: `${violations.length} required OWASP category(ies) not covered`, detail: violations.join('\n') };
  return { pass: true, code: 'ST002', message: 'All required OWASP categories covered by rule sets' };
}
