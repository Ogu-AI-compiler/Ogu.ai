import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * JN008 — no-todos
 * Prohibits TODO, FIXME, HACK, and XXX markers in Jupyter notebook code.
 *
 * Why:
 * - TODO markers represent deferred technical debt that rarely gets resolved.
 *   Once a marker ships to production it becomes invisible — never appearing
 *   in the backlog, never assigned to anyone, silently accumulating.
 * - FIXME markers document known bugs in production code. Code broken enough
 *   to warrant a FIXME is broken enough to fix before merging.
 * - HACK markers acknowledge intentional correctness bypasses. In data
 *   pipelines and ML code these compound silently, corrupting quality over time.
 * - Automated enforcement is the only mechanism that works — manual code
 *   review misses deferred-debt markers routinely.
 *
 * Escape hatch: none — TODOs must be converted to tracked issues before merge.
 */

export async function run({ dir }) {
  const EXT = ['.py', '.ipynb', '.md'];
  const files = readdirSync(dir).filter(f => EXT.some(e => f.endsWith(e)));
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(join(dir, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/\b(TODO|FIXME|HACK|XXX)\b/.test(line)) {
        violations.push(`${file}:${i + 1} — ${line.trim()}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'JN008',
      message: `${violations.length} TODO/FIXME/HACK marker(s) found — resolve before shipping`,
      detail: violations.join('\n') +
              '\n\nConvert each TODO to a tracked issue with a link, then remove the marker.',
    };
  }

  return { pass: true, code: 'JN008', message: `No TODO/FIXME/HACK markers in ${files.length} file(s)` };
}
