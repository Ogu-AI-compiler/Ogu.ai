import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * AR005 — no-raw-sql
 * API route handlers must not construct raw SQL strings.
 * Raw SQL in route handlers bypasses the ORM layer and risks SQL injection.
 *
 * Detected patterns:
 *   - Template literal or string starting with SELECT/INSERT/UPDATE/DELETE
 *   - query("SELECT ..."), query(`INSERT ...`)
 *   - db.query(), $queryRaw, $executeRaw, knex.raw(), .raw(
 *
 * Escape hatch: add a comment before the line:
 *   // @raw-sql-ok: reason
 */

const RAW_SQL_PATTERNS = [
  /`\s*SELECT\s+/i,
  /`\s*INSERT\s+INTO\s+/i,
  /`\s*UPDATE\s+\w+\s+SET\s+/i,
  /`\s*DELETE\s+FROM\s+/i,
  /"\s*SELECT\s+.{0,80}FROM\s+/i,
  /'\s*SELECT\s+.{0,80}FROM\s+/i,
  /query\s*\(\s*["'`]\s*(?:SELECT|INSERT|UPDATE|DELETE)/i,
  /\$queryRaw\s*`/,
  /\$executeRaw\s*`/,
  /knex\.raw\s*\(/,
  /db\.query\s*\(/,
  /\.raw\s*\(/,
];

const ESCAPE_HATCH = /@raw-sql-ok:/;

// Route handler file name patterns — covers common conventions
const ROUTE_FILE_RE = /\.(handler|route|controller|router|api)\.(ts|js)$|^(?:route|handler|controller|router|index)\.(ts|js)$/;

function getRouteFiles(dir) {
  const results = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }

    for (const f of entries) {
      if (f.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(f.name)) continue;
        walk(join(d, f.name));
      } else if (
        f.name.match(/\.(ts|js)$/) &&
        !f.name.includes('.test.') &&
        !f.name.includes('.spec.') &&
        !f.name.match(/\.d\.ts$/)
      ) {
        results.push(join(d, f.name));
      }
    }
  }

  walk(dir);
  return results;
}

export async function run({ dir }) {
  const files = getRouteFiles(dir);

  if (files.length === 0) {
    return { pass: true, code: 'AR005', message: 'No source files found in route dir — skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

      if (RAW_SQL_PATTERNS.some(re => re.test(line))) {
        // Check preceding 3 lines for escape hatch
        const context = lines.slice(Math.max(0, i - 3), i).join('\n');
        if (!ESCAPE_HATCH.test(context)) {
          violations.push(`${file.replace(dir + '/', '')}: ${i + 1} — ${trimmed.slice(0, 80)}`);
        }
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'AR005',
      message: `${violations.length} raw SQL instance(s) in route handler(s)`,
      detail: violations.join('\n')
        + '\n\nUse ORM methods (prisma.user.findMany, typeorm repo.find) or parameterized queries.'
        + '\nTo allow intentional raw SQL: add // @raw-sql-ok: <reason> before the line.',
    };
  }

  return {
    pass: true, code: 'AR005',
    message: `No raw SQL in ${files.length} route file(s)`,
  };
}
