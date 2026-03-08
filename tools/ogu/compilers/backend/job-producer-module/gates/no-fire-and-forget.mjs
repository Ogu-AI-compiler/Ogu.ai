import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * JP005 — no-fire-and-forget
 * Every enqueue call must be awaited.
 * Un-awaited enqueues silently fail and the error is swallowed.
 *
 * FORBIDDEN: queue.add(name, payload)  (no await)
 * ALLOWED:   await queue.add(name, payload)
 * ALLOWED:   const job = await queue.add(...)
 */

const UNAWAITED_ENQUEUE = /^(?!\s*(?:await|return\s+await|const\s+\w+\s*=\s*await|let\s+\w+\s*=\s*await))\s*(?:queue|bull|boss|producer)\s*\.\s*(?:add|createJob|send|publish)\s*\(/m;

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

// Line-level check: line has enqueue call but no await/return before it
const ENQUEUE_CALL = /(?:queue|bull|boss|producer)\s*\.\s*(?:add|createJob|send|publish)\s*\(/i;
const HAS_AWAIT = /\bawait\b/;
const HAS_RETURN = /\breturn\b/;

export async function run({ dir }) {
  const files = collectFiles(dir);
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (ENQUEUE_CALL.test(line) && !HAS_AWAIT.test(line) && !HAS_RETURN.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — enqueue not awaited: ${line.trim().slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'JP005',
      message: `${violations.length} fire-and-forget enqueue(s) detected`,
      detail: violations.slice(0, 10).join('\n') + '\n\nAll enqueue calls must be awaited to catch failures.'
    };
  }

  return { pass: true, code: 'JP005', message: `All enqueue calls awaited (${files.length} file(s) checked)` };
}
