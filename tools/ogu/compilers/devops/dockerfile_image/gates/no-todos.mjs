/**
 * Gate: no-todos (DF009)
 * Scans the Dockerfile for TODO, FIXME, HACK, PLACEHOLDER, and XXX markers. These
 * indicate incomplete configuration that was left in place — anything still marked
 * as a placeholder in a shipped Dockerfile is an unresolved decision.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

function findDockerfile(dir) {
  const candidates = ['Dockerfile', 'dockerfile', 'Dockerfile.prod', 'Dockerfile.production'];
  for (const name of candidates) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  try {
    const df = readdirSync(dir).find(e => e.toLowerCase().startsWith('dockerfile'));
    if (df) return join(dir, df);
  } catch { /* unreadable */ }
  return null;
}

const TODO_PATTERN = /\b(TODO|FIXME|HACK|PLACEHOLDER|XXX)\b/i;

export async function run({ dir }) {
  const dfPath = findDockerfile(dir);
  if (!dfPath) return { pass: true, code: 'DF009', message: 'No Dockerfile — skipped', skipped: true };

  const lines      = readFileSync(dfPath, 'utf8').split('\n');
  const violations = lines.reduce((acc, line, i) => {
    if (TODO_PATTERN.test(line)) acc.push({ line: i + 1, content: line.trim() });
    return acc;
  }, []);

  if (violations.length) {
    return {
      pass: false, code: 'DF009',
      message: `${violations.length} TODO/FIXME marker(s) found in Dockerfile`,
      detail: {
        violations,
        hint: 'Resolve all placeholder markers before shipping — each TODO is an unfinished configuration decision',
      },
    };
  }

  return { pass: true, code: 'DF009', message: 'No TODO/FIXME markers in Dockerfile' };
}
