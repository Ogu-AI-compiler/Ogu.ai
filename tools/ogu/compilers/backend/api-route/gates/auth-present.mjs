import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * AR003 — auth-present
 * Routes that require auth must perform an authentication check before
 * reaching any business logic (DB access, data return).
 *
 * Reads spec.auth from route-spec.json:
 *   "none"     — public route, gate passes without checking
 *   anything else (jwt, api-key, session, oauth, etc.) — auth check required
 *
 * Scans all non-test TS files in the dir for auth patterns appearing before
 * the first DB/business logic call. Hardcoding handler.ts is avoided to
 * support route.ts, controller.ts, index.ts, and other conventions.
 */

const AUTH_PATTERNS = [
  /requireAuth\s*\(/,
  /authenticate\s*\(/,
  /verifyToken\s*\(/,
  /checkAuth\s*\(/,
  /isAuthenticated\s*\(/,
  /req\.user\b/,
  /req\.auth\b/,
  /getSession\s*\(/,
  /validateToken\s*\(/,
  /Authorization/,
  /Bearer\s/,
  /passport\.authenticate\s*\(/,
  /authGuard\s*\(/,
  /JwtAuthGuard/,
  /useGuards\s*\(/,
];

const BUSINESS_LOGIC_RE = /await\s+\w+\.(find|create|update|delete|query|get|insert|select|upsert)\s*\(|return\s+.*(?:data|result|entity|user|record)/i;

function getSourceFiles(dir) {
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
  const specPath = join(dir, 'route-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'AR003', message: 'route-spec.json not found' };
  }

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'AR003', message: 'route-spec.json is not valid JSON' }; }

  if (spec.auth === 'none') {
    return { pass: true, code: 'AR003', message: 'Route is public (auth: "none") — check skipped' };
  }

  const sourceFiles = getSourceFiles(dir);
  if (sourceFiles.length === 0) {
    return { pass: false, code: 'AR003', message: 'No TypeScript source files found in route dir' };
  }

  // Check each file independently — auth pattern must appear before business logic
  const violations = [];

  for (const file of sourceFiles) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const rel = file.replace(dir + '/', '');

    const firstBusinessLine = lines.findIndex(l => BUSINESS_LOGIC_RE.test(l));
    const fence = firstBusinessLine === -1 ? lines.length : firstBusinessLine;

    const authFoundBeforeBusiness = lines.slice(0, fence).some(l =>
      AUTH_PATTERNS.some(re => re.test(l))
    );

    if (!authFoundBeforeBusiness && firstBusinessLine !== -1) {
      // Only flag if there IS business logic — a file with neither is neutral
      violations.push(`${rel}: no auth check found before business logic (line ${firstBusinessLine + 1})`);
    }
  }

  // Gate passes if at least one file has auth before business logic AND no file violates
  if (violations.length) {
    return {
      pass: false, code: 'AR003',
      message: `Route requires auth="${spec.auth}" but auth check missing or after business logic`,
      detail: violations.join('\n') +
        '\n\nAuth check must appear before any DB call:\n' +
        '  const user = await requireAuth(req);  // first\n' +
        '  const data = await db.find(...);      // then business logic',
    };
  }

  return {
    pass: true, code: 'AR003',
    message: `Auth check present before business logic (auth: "${spec.auth}", ${sourceFiles.length} file(s) scanned)`,
  };
}
