/**
 * Gate: no-todos (KO006)
 * Scans kustomize-spec.json for TODO, FIXME, HACK, and PLACEHOLDER markers.
 * Placeholder base paths or environment names will cause kustomize to target
 * the wrong directory or produce manifests for the wrong environment.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const lines      = readFileSync(join(dir, 'kustomize-spec.json'), 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'KO006',
      message: `${violations.length} TODO/FIXME marker(s) found in kustomize-spec.json`,
      detail: {
        violations,
        hint: 'Fill in real base paths, environment names, and namespace overrides — placeholder values deploy to the wrong environment',
      },
    };
  }

  return { pass: true, code: 'KO006', message: 'No TODO/FIXME markers in kustomize-spec.json' };
}
