import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SS004 — cleanup-declared
 * Test seed scenarios must have a teardown/cleanup function to reverse the seed.
 * This ensures tests don't leak state.
 *
 * If spec.environment === 'development', skip (dev seeds don't need cleanup).
 */

const CLEANUP_PATTERNS = [
  /export\s+(?:async\s+)?function\s+(?:teardown|cleanup|reset|rollback|clear)\s*\(/i,
  /exports\s*\.\s*(?:teardown|cleanup|reset|clear)\s*=/i,
  /module\s*\.\s*exports\s*.*(?:teardown|cleanup)/i,
];

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules','dist','.git'].includes(f.name)) walk(join(d,f.name)); }
      else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) files.push(join(d,f.name));
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'seed-scenario-spec.json'), 'utf8'));
  if (spec.environment === 'development') return { pass: true, code: 'SS004', message: 'Development seed — cleanup not required', skipped: true };

  const files = collectFiles(dir);
  const allContent = files.map(f => readFileSync(f, 'utf8')).join('\n');

  for (const pattern of CLEANUP_PATTERNS) {
    if (pattern.test(allContent)) return { pass: true, code: 'SS004', message: `Cleanup/teardown function declared (${files.length} file(s))` };
  }

  return {
    pass: false, code: 'SS004',
    message: 'No cleanup/teardown function found',
    detail: 'Export a cleanup function:\nexport async function teardown() {\n  await prisma.user.deleteMany({ where: { id: { in: SEED_IDS } } });\n}'
  };
}
