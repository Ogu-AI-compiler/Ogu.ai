import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * CA007 — invalidation-scoped
 * Any cache invalidation (del, unlink, flushPattern) must only target namespaces
 * declared in spec.invalidates. Cross-namespace invalidation without declaration is forbidden.
 */

const INVALIDATE_CALL = /(?:cache|redis|client)\s*\.\s*(?:del|unlink|delete|flush|invalidate)\s*\([^)]*['"`]([^'"`]+)['"`]/i;

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
  const spec = JSON.parse(readFileSync(join(dir, 'cache-spec.json'), 'utf8'));
  const allowedNamespaces = new Set([spec.namespace, ...(spec.invalidates || [])]);

  const files = collectFiles(dir);
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      const m = INVALIDATE_CALL.exec(line);
      if (!m) continue;
      const keyStr = m[1];
      // Check if the key starts with any allowed namespace
      const matchesAllowed = [...allowedNamespaces].some(ns => keyStr.startsWith(ns));
      if (!matchesAllowed) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — invalidation target "${keyStr}" not in declared namespaces: [${[...allowedNamespaces].join(', ')}]`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'CA007',
      message: `${violations.length} out-of-scope invalidation(s) found`,
      detail: violations.slice(0, 10).join('\n') + '\n\nAdd namespaces to spec.invalidates[] to allow cross-namespace invalidation.'
    };
  }

  return {
    pass: true, code: 'CA007',
    message: `All invalidations within declared namespaces: [${[...allowedNamespaces].join(', ')}]`
  };
}
