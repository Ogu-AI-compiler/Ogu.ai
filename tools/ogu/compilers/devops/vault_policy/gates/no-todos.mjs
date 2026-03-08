/**
 * Gate: no-todos (VP007)
 * Scans vault-policy-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * A Vault policy spec with placeholder paths or capabilities will grant access
 * to literal placeholder strings rather than real secrets — the policy will be
 * silently misconfigured in production.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'vault-policy-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'VP007',
      message: `${violations.length} TODO/FIXME marker(s) found in vault policy spec`,
      detail: {
        violations,
        hint: 'Fill in real Vault paths and capabilities — placeholder values become literal policy rules that grant no useful access',
      },
    };
  }

  return { pass: true, code: 'VP007', message: 'No TODO/FIXME markers in vault policy spec' };
}
