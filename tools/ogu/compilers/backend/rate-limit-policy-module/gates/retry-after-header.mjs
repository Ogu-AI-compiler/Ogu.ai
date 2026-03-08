import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * RL003 — retry-after-header
 * 429 responses must include Retry-After header so clients know when to retry.
 */

const STATUS_429 = /(?:status\s*\(\s*429|sendStatus\s*\(\s*429|429\s*,)/;
const RETRY_AFTER = /[Rr]etry-[Aa]fter|retry_after/;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(f.name)) walk(join(d, f.name));
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
  let has429 = false;
  let hasRetryAfter = false;

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (STATUS_429.test(content)) has429 = true;
    if (RETRY_AFTER.test(content)) hasRetryAfter = true;
  }

  if (!has429) return { pass: true, code: 'RL003', message: 'No explicit 429 response found — using middleware (Retry-After check skipped)', skipped: true };
  if (!hasRetryAfter) return { pass: false, code: 'RL003', message: '429 returned but no Retry-After header set', detail: 'Add: res.set("Retry-After", Math.ceil(windowSeconds - (Date.now()/1000 % windowSeconds)));' };

  return { pass: true, code: 'RL003', message: `Retry-After header present alongside 429 responses` };
}
