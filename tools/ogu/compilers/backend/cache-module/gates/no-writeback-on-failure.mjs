import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * CA006 — no-writeback-on-failure
 * If origin read fails (catch block), the module must NOT write to cache.
 * Writing stale/error data back to cache would propagate the failure to future callers.
 *
 * Detection: Look for cache.set / redis.set inside catch blocks.
 * The escape hatch: // @writeback-ok: reason
 */

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

const CACHE_SET = /(?:cache|redis|client)\s*\.\s*(?:set|hSet|mSet|setEx)\s*\(/i;
const ESCAPE = /@writeback-ok/;

export async function run({ dir }) {
  const files = collectFiles(dir);
  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let inCatch = false;
    let catchDepth = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\bcatch\s*\(/.test(line)) {
        inCatch = true;
        catchDepth = braceDepth;
      }
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      if (inCatch && braceDepth <= catchDepth) inCatch = false;

      if (inCatch && CACHE_SET.test(line) && !ESCAPE.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — cache.set inside catch block`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'CA006',
      message: `${violations.length} write-back in catch block(s) found`,
      detail: violations.slice(0, 10).join('\n') + '\n\nDo not cache on failure. Add // @writeback-ok: reason if intentional (e.g. negative caching).'
    };
  }

  return { pass: true, code: 'CA006', message: `No write-back on failure (${files.length} file(s) checked)` };
}
