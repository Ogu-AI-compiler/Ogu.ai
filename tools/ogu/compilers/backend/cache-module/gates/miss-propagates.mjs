import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * CA005 — miss-propagates
 * On a cache miss the code must call the origin (DB / service) and return its result.
 * Returning null/undefined/false silently on miss is forbidden.
 *
 * Detection strategy (per cache.get call site, not globally):
 *   GOOD: cache.get(key) → null check → await origin.find(...)  → cache.set + return
 *   BAD:  cache.get(key) → null check → return null
 *
 * Each call site is evaluated independently. A file that has one correct pattern
 * and one silent miss still produces a violation for the silent miss.
 */

const CACHE_GET_RE = /(?:cache|redis|client)\s*\.\s*(?:get|hGet|mGet)\s*\(/i;
const ORIGIN_CALL_RE = /await\s+(?:\w+\.)+(?:findOne|findMany|findById|findUnique|find|query|fetch|get|select)\s*\(/i;
const RETURN_NULL_RE = /return\s+(?:null|undefined|false|''|"")\s*;/;

// Window size to scan after a cache.get call (lines)
const WINDOW = 30;

function collectFiles(dir) {
  const files = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }

    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(ts|mjs|js)$/) && !e.name.match(/\.(test|spec|d)\./)) {
        files.push(join(d, e.name));
      }
    }
  }

  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  let totalCacheGetSites = 0;
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (!CACHE_GET_RE.test(content)) continue;

    const lines = content.split('\n');
    const rel = file.replace(dir + '/', '');

    for (let i = 0; i < lines.length; i++) {
      if (!CACHE_GET_RE.test(lines[i])) continue;

      totalCacheGetSites++;

      // Examine the next WINDOW lines for origin call or silent null return
      const window = lines.slice(i + 1, i + 1 + WINDOW).join('\n');
      const hasOrigin = ORIGIN_CALL_RE.test(window);
      const hasSilentReturn = RETURN_NULL_RE.test(window);

      // Per call-site: flag if there's a null return and no origin call in the window
      if (!hasOrigin && hasSilentReturn) {
        violations.push(`${rel}:${i + 1} — cache miss returns null/undefined without origin fallback`);
      }
    }
  }

  if (totalCacheGetSites === 0) {
    return { pass: true, code: 'CA005', message: 'No cache get calls found — skipped', skipped: true };
  }

  if (violations.length) {
    return {
      pass: false, code: 'CA005',
      message: `${violations.length} cache miss(es) with silent null return — origin not called`,
      detail: violations.slice(0, 10).join('\n') +
        '\n\nCorrect pattern:\n' +
        '  const cached = await cache.get(key);\n' +
        '  if (cached) return cached;\n' +
        '  const fresh = await db.find(id);  // ← always call origin\n' +
        '  await cache.set(key, fresh);\n' +
        '  return fresh;',
    };
  }

  return {
    pass: true, code: 'CA005',
    message: `Cache miss propagation verified — ${totalCacheGetSites} call site(s) in ${files.length} file(s)`,
  };
}
