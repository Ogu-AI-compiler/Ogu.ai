/**
 * Why:
 * Bare `except:` blocks silently swallow all exceptions including
 * KeyboardInterrupt and SystemExit. In a serving API this means:
 * - Prediction failures return 200 OK with incorrect output instead of 500
 * - Memory errors are silently ignored, corrupting future requests
 * - The caller has no way to detect that something went wrong
 *
 * Required: all except clauses must catch a specific exception type.
 * Acceptable: `except Exception as e: raise HTTPException(...)` — re-raises
 * as an HTTP error, which is the correct pattern for serving APIs.
 *
 * Escape hatch: add `# @bare-except-ok: <reason>` on the except line for
 * genuinely justified cases (e.g., a top-level crash reporter that must
 * survive any exception type).
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BARE_EXCEPT_RE = /^\s*except\s*:/;
const ESCAPE_RE      = /@bare-except-ok/;

export async function run({ dir }) {
  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) return { pass: false, code: 'SA006', message: 'No Python files found' };

  const violations = [];

  for (const f of pyFiles) {
    const lines = readFileSync(join(dir, f), 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!BARE_EXCEPT_RE.test(line)) continue;
      if (ESCAPE_RE.test(line)) continue;
      // Check prev line for escape hatch comment
      if (i > 0 && ESCAPE_RE.test(lines[i - 1])) continue;
      violations.push(`${f}:${i + 1}: bare \`except:\` — catches everything including SystemExit`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SA006',
      message: `${violations.length} bare except: block(s) found`,
      detail: violations.join('\n') + '\n\n' +
              'Replace with specific exception types:\n' +
              '  except ValueError as e:        # specific input error\n' +
              '  except Exception as e:         # all exceptions (acceptable if re-raised)\n' +
              '      raise HTTPException(500)   # re-raise as HTTP error\n' +
              'Add # @bare-except-ok: <reason> to suppress specific occurrences.',
    };
  }
  return { pass: true, code: 'SA006', message: 'No bare except: blocks found' };
}
