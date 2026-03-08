import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * OR009 — no-raw-sql
 * Repository files must not use raw SQL unless explicitly marked with an escape hatch.
 *
 * Raw SQL in repositories:
 *   - Bypasses ORM type checking (parameters are untyped strings)
 *   - Risks SQL injection if interpolation is used instead of parameterized queries
 *   - Creates a hidden abstraction layer — callers don't know a raw query is used
 *   - Cannot be intercepted by ORM middleware (logging, tracing, retry logic)
 *
 * Escape hatch: add a comment before the raw SQL call:
 *   // @raw-sql-ok: Requires database-specific JSON aggregation not supported by ORM
 *
 * Detected patterns: $queryRaw, $executeRaw, knex.raw, db.query, .raw(,
 * and query("SELECT...") / query(`INSERT...`) style calls.
 */

const RAW_SQL_PATTERNS = [
  /\$queryRaw\s*`/,
  /\$executeRaw\s*`/,
  /knex\.raw\s*\(/,
  /db\.query\s*\(/,
  /\.raw\s*\(/,
  /query\s*\(\s*['"`]\s*(?:SELECT|INSERT|UPDATE|DELETE)/i,
];

const ESCAPE_HATCH_RE = /@raw-sql-ok:/;

function getRepoFiles(dir) {
  const results = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }

    for (const f of entries) {
      if (f.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(f.name)) continue;
        walk(join(d, f.name));
      } else if (
        f.name.endsWith('.ts') &&
        !f.name.includes('.test.') &&
        !f.name.includes('.spec.') &&
        !f.name.match(/\.d\.ts$/) &&
        (f.name.includes('.repo.') || f.name.toLowerCase().includes('repository'))
      ) {
        results.push(join(d, f.name));
      }
    }
  }

  walk(dir);
  return results;
}

export async function run({ dir }) {
  const repoFiles = getRepoFiles(dir);

  if (repoFiles.length === 0) {
    return { pass: true, code: 'OR009', message: 'No repository files found — skipped', skipped: true };
  }

  const violations = [];

  for (const file of repoFiles) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const rel = file.replace(dir + '/', '');

    lines.forEach((line, i) => {
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

      if (RAW_SQL_PATTERNS.some(p => p.test(line))) {
        // Check the 3 preceding lines for an escape hatch comment
        const preceding = lines.slice(Math.max(0, i - 3), i).join('\n');
        if (!ESCAPE_HATCH_RE.test(preceding)) {
          violations.push(`${rel}:${i + 1} — raw SQL without escape hatch: ${line.trim().slice(0, 80)}`);
        }
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'OR009',
      message: `${violations.length} unauthorized raw SQL usage(s) in repository file(s)`,
      detail: violations.join('\n') +
        '\n\nTo allow intentional raw SQL, add before the call:\n' +
        '  // @raw-sql-ok: <reason>\n' +
        '  await prisma.$queryRaw`SELECT ...`',
    };
  }

  return {
    pass: true, code: 'OR009',
    message: `No unauthorized raw SQL in ${repoFiles.length} repository file(s)`,
  };
}
