import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * CA004 — no-inline-ttl
 * TTL values must come from the topology config or a config module, not hardcoded numbers
 * passed directly to set/setEx/expire calls.
 *
 * ALLOWED:   redis.set(key, val, { EX: ttl })           // ttl is a variable
 * ALLOWED:   redis.set(key, val, { EX: config.ttl })    // from config
 * ALLOWED:   redis.set(key, val, { EX: TTL_SECONDS })   // named constant (UPPER_CASE)
 * FORBIDDEN: redis.set(key, val, { EX: 3600 })          // literal number
 * FORBIDDEN: redis.setEx(key, 86400, val)               // literal number
 * FORBIDDEN: client.expire(key, 900)                    // literal number
 *
 * The escape hatch: // @inline-ttl-ok: <reason>
 */

const TTL_LITERAL = /(?:\.set(?:Ex)?\s*\([^)]*,\s*\d{2,}\s*[,)]|EX\s*:\s*\d{2,}|expire\s*\([^)]*,\s*\d{2,}\s*\))/;
const ESCAPE = /@inline-ttl-ok/;

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
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (ESCAPE.test(line)) continue;
      if (TTL_LITERAL.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — inline TTL literal: ${line.trim().slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'CA004',
      message: `${violations.length} inline TTL literal(s) found`,
      detail: violations.slice(0, 10).join('\n') + '\n\nUse a variable from config/topology or add // @inline-ttl-ok: reason'
    };
  }

  return { pass: true, code: 'CA004', message: `No inline TTL literals — all from config/topology (${files.length} file(s) checked)` };
}
