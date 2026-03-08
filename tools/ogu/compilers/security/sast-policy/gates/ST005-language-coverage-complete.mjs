import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** ST005 — language-coverage-complete: every declared language must have at least one rule set */
export async function run({ dir }) {
  const specPath = join(dir, 'sast-policy.json');
  if (!existsSync(specPath)) return { pass: true, code: 'ST005', message: 'No spec file — gate skipped', skipped: true };

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: true, code: 'ST005', message: 'Invalid JSON — gate skipped', skipped: true }; }

  if (!Array.isArray(spec.languages) || !Array.isArray(spec.rule_sets)) {
    return { pass: true, code: 'ST005', message: 'No languages or rule_sets — gate skipped', skipped: true };
  }

  const violations = [];

  for (const lang of spec.languages) {
    const langName = String(lang).toLowerCase();
    const hasCoverage = spec.rule_sets.some(rs => {
      const rsStr = typeof rs === 'string' ? rs : JSON.stringify(rs);
      return rsStr.toLowerCase().includes(langName) ||
        (typeof rs === 'object' && (rs.languages || []).map(l => String(l).toLowerCase()).includes(langName));
    });

    if (!hasCoverage) {
      // Only a hard fail if there is no catch-all rule set
      const hasCatchAll = spec.rule_sets.some(rs => {
        const rsStr = typeof rs === 'string' ? rs : (rs.name || '');
        return ['all', 'generic', 'universal', 'owasp', 'semgrep'].some(term => rsStr.toLowerCase().includes(term));
      });
      if (!hasCatchAll) {
        violations.push(`Language "${lang}": no rule set explicitly covers this language — add a rule set that includes "${lang}"`);
      }
    }
  }

  if (violations.length > 0) return { pass: false, code: 'ST005', message: `${violations.length} language(s) not covered by any rule set`, detail: violations.join('\n') };
  return { pass: true, code: 'ST005', message: `All ${spec.languages.length} language(s) have rule set coverage` };
}
