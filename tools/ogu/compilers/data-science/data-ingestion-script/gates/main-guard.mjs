import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * DI003 — main-guard
 * Data ingestion scripts must guard top-level execution with
 * if __name__ == "__main__" to prevent side effects on import.
 *
 * Why: same as MT002 and DP003. Ingestion-specific:
 * - Ingestion scripts often make network/API/database calls at startup.
 *   Without a main guard, importing the module triggers those calls in
 *   test environments, CI pipelines, and type checkers.
 *
 * Escape hatch: # @no-main-guard-ok: <reason>
 */

const MAIN_GUARD_RE = /if\s+__name__\s*==\s*['"]__main__['"]/;

export async function run({ dir }) {
  const files = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!files.length) {
    return { pass: true, code: 'DI003', message: 'No Python files — main guard check skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const text = readFileSync(join(dir, file), 'utf8');
    if (/@no-main-guard-ok/.test(text)) continue;
    if (!MAIN_GUARD_RE.test(text)) {
      // Only flag if there's actual execution code (not just definitions)
      if (/^(?!def |class |import |from |#|\s*$)[\w]/m.test(text)) {
        violations.push(`${file}: executable code at module level without if __name__ == "__main__"`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'DI003',
      message: `${violations.length} ingestion script(s) missing main guard`,
      detail: violations.join('\n') +
        '\n\nWrap execution:\n' +
        '  def ingest(config): ...\n\n' +
        '  if __name__ == "__main__":\n' +
        '      config = load_config()\n' +
        '      ingest(config)',
    };
  }

  return { pass: true, code: 'DI003', message: 'if __name__ == "__main__" guard present' };
}
