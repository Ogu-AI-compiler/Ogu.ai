import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * HC005 — no-destructive-ops
 * Health checks must be read-only. No writes, deletes, or side effects.
 * BAD: INSERT INTO health_checks..., DELETE FROM ..., redis.del(...)
 * GOOD: SELECT 1, redis.ping(), db.$queryRaw`SELECT 1`
 */

const DESTRUCTIVE_PATTERNS = [
  /\bINSERT\s+INTO\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bUPDATE\s+\w+\s+SET\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bTRUNCATE\b/i,
  /\.del\s*\(/,          // redis.del()
  /\.delete\s*\(/,
  /\.set\s*\(/,          // redis.set() - writes
  /\.hset\s*\(/,
  /\.rpush\s*\(/,
  /prisma\.\w+\.create\s*\(/,
  /prisma\.\w+\.update\s*\(/,
  /prisma\.\w+\.delete\s*\(/,
  /db\.\w+\.insert\s*\(/,
];

// SAFE patterns that look like writes but are actually reads or pings
const SAFE_EXCEPTIONS = [
  /SELECT\s+1/i,
  /\.ping\s*\(\s*\)/,
  /\$queryRaw.*SELECT/i,
];

function findHealthFiles(dir) {
  const results = [];
  function walk(d) {
    let entries; try { entries = readdirSync(d, {withFileTypes:true}); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) { if (['node_modules','dist','.git'].includes(e.name)) continue; walk(join(d, e.name)); }
      else if (e.name.match(/health|liveness|readiness/) && e.name.endsWith('.ts')) results.push(join(d, e.name));
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const healthFiles = findHealthFiles(dir);
  if (healthFiles.length === 0) {
    return { pass: true, code: 'HC005', message: 'No health files found — no-destructive-ops gate skipped', skipped: true };
  }

  const violations = [];

  for (const file of healthFiles) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.trim().startsWith('//')) return;
      // Check for destructive pattern, but allow safe exceptions
      const isDestructive = DESTRUCTIVE_PATTERNS.some(p => p.test(line));
      const isSafe = SAFE_EXCEPTIONS.some(p => p.test(line));
      if (isDestructive && !isSafe) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — destructive operation in health check: ${line.trim()}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'HC005',
      message: `${violations.length} destructive operation(s) found in health checks`,
      detail: violations.join('\n') + '\n\nHealth checks must be read-only: SELECT 1, ping(), $queryRaw`SELECT 1`'
    };
  }

  return { pass: true, code: 'HC005', message: 'No destructive operations in health checks' };
}
