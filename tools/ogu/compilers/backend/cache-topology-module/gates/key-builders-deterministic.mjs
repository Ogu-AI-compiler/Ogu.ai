import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * CT005 — key-builders-deterministic
 * Cache key builder functions must be deterministic — given the same inputs, always the same output.
 * Detect: Date.now(), new Date(), Math.random(), crypto.randomUUID(), process.pid
 */

const NON_DETERMINISTIC_PATTERNS = [
  /Date\.now\s*\(\s*\)/,
  /new Date\s*\(\s*\)/,
  /Math\.random\s*\(\s*\)/,
  /crypto\.randomUUID\s*\(\s*\)/,
  /randomBytes/,
  /process\.pid\b/,
  /performance\.now\s*\(\s*\)/,
];

function findCacheFiles(dir) {
  const results = [];
  const cacheDirs = ['src/lib/cache', 'lib/cache', 'src/cache'];
  for (const rel of cacheDirs) {
    const p = join(dir, rel);
    if (!existsSync(p)) continue;
    try {
      readdirSync(p, { withFileTypes: true }).forEach(e => {
        if (!e.isDirectory() && e.name.match(/keys|policy|cache/i) && e.name.endsWith('.ts')) {
          results.push(join(p, e.name));
        }
      });
    } catch { /* skip */ }
  }
  return results;
}

export async function run({ dir }) {
  const cacheFiles = findCacheFiles(dir);

  if (cacheFiles.length === 0) {
    return {
      pass: true, code: 'CT005',
      message: 'Cache module files not yet created — key-builders-deterministic gate skipped',
      skipped: true
    };
  }

  const violations = [];

  for (const file of cacheFiles) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    // Only check lines that look like they're in a key-building function
    let inKeyBuilder = false;
    lines.forEach((line, i) => {
      if (/function.*[Kk]ey|=>.*key|buildKey|makeKey|cacheKey/.test(line)) inKeyBuilder = true;
      if (inKeyBuilder && /^}/.test(line.trim())) inKeyBuilder = false;

      if (NON_DETERMINISTIC_PATTERNS.some(p => p.test(line))) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — non-deterministic call in cache key context: ${line.trim()}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'CT005',
      message: `${violations.length} non-deterministic call(s) in cache key builders`,
      detail: violations.join('\n') + '\n\nCache keys must be pure functions of their declared inputs only.'
    };
  }

  return {
    pass: true, code: 'CT005',
    message: `Cache key builders are deterministic (${cacheFiles.length} file(s) checked)`
  };
}
