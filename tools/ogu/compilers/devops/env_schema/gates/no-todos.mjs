/**
 * Gate: no-todos (ES006)
 * Scans the env-schema-spec.json for TODO, FIXME, HACK, PLACEHOLDER, and XXX markers.
 * Any such marker in a shipped spec indicates an incomplete definition — the schema
 * is not ready to be treated as a runtime contract.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const specPath = join(dir, 'env-schema-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'ES006', message: 'No spec file — no-todos skipped', skipped: true };
  }

  const lines      = readFileSync(specPath, 'utf8').split('\n');
  const violations = [];

  lines.forEach((line, i) => {
    if (TODO_PATTERN.test(line)) {
      violations.push({ line: i + 1, content: line.trim() });
    }
  });

  if (violations.length) {
    return {
      pass: false, code: 'ES006',
      message: `${violations.length} TODO/FIXME marker(s) found in spec`,
      detail: {
        violations,
        hint: 'Resolve all placeholder markers before treating this spec as a contract — each TODO represents an unfinished decision',
      },
    };
  }

  return { pass: true, code: 'ES006', message: 'No TODO/FIXME markers found in spec' };
}
