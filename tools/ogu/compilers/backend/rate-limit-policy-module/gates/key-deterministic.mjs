import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * RL002 — key-deterministic
 * Rate limit key builder functions must not use non-deterministic values.
 *
 * A rate limit key must be identical for the same logical request across
 * all instances and restarts. Non-deterministic keys mean:
 *   - Date.now() / new Date(): key changes every millisecond — limit never triggered
 *   - Math.random(): different key on every call — effectively no rate limiting
 *   - crypto.randomUUID() / nanoid(): same problem as random
 *
 * Key builders should derive from: req.ip, req.userId, req.apiKey, route path, etc.
 *
 * Detection: finds key builder function declarations, then scans the function body
 * (up to 30 lines) for non-deterministic calls.
 */

const NON_DETERMINISTIC_RE = /\bDate\.now\s*\(\s*\)|\bMath\.random\s*\(\s*\)|\bnew Date\s*\(\s*\)|\bcrypto\.randomUUID\s*\(\s*\)|\bnanoid\s*\(\s*\)|\buuid\s*\(\s*\)/;

// Matches the start of a key builder function declaration
const KEY_FN_RE = /(?:function\s+\w*[Kk]ey\w*|(?:buildKey|makeKey|rateLimitKey|getKey|keyFor)\s*[=(])/;

const FUNCTION_BODY_WINDOW = 30;

function collectFiles(dir) {
  const files = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }

    for (const f of entries) {
      if (f.isDirectory()) {
        if (['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(f.name)) continue;
        walk(join(d, f.name));
      } else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.(test|spec|d)\./)) {
        files.push(join(d, f.name));
      }
    }
  }

  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectFiles(dir);

  if (files.length === 0) {
    return { pass: true, code: 'RL002', message: 'No source files found — skipped', skipped: true };
  }

  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const rel = file.replace(dir + '/', '');

    for (let i = 0; i < lines.length; i++) {
      if (!KEY_FN_RE.test(lines[i])) continue;

      // Scan the function body window
      const body = lines.slice(i, i + FUNCTION_BODY_WINDOW).join('\n');
      if (NON_DETERMINISTIC_RE.test(body)) {
        violations.push(`${rel}:${i + 1} — non-deterministic value in rate limit key builder`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'RL002',
      message: `${violations.length} non-deterministic rate limit key builder(s)`,
      detail: violations.join('\n') +
        '\n\nKey builders must be deterministic:\n' +
        '  ✓ buildKey({ ip, userId }) { return `rl:${userId}:${ip}`; }\n' +
        '  ✗ buildKey({ ip }) { return `rl:${ip}:${Date.now()}`; }  // resets every ms',
    };
  }

  return {
    pass: true, code: 'RL002',
    message: `Rate limit keys are deterministic (${files.length} file(s) checked)`,
  };
}
