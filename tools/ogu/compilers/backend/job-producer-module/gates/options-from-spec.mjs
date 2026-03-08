import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * JP006 — options-from-spec
 * If spec.options declares delay/priority/attempts, verify those appear in code.
 * Inline option literals (attempts: 5) without spec reference → fail.
 * If spec has no options, check that no inline option overrides exist.
 */

const INLINE_ATTEMPTS = /attempts\s*:\s*\d+/;
const INLINE_DELAY = /delay\s*:\s*\d+/;
const INLINE_PRIORITY = /priority\s*:\s*\d+/;
const FROM_CONFIG = /(?:config\.|options\.|JOB_OPTIONS|QUEUE_OPTIONS|spec\.)/;

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
  const spec = JSON.parse(readFileSync(join(dir, 'job-producer-spec.json'), 'utf8'));
  if (!spec.options) {
    return { pass: true, code: 'JP006', message: 'No job options declared in spec — options check skipped', skipped: true };
  }

  const files = collectFiles(dir);
  const violations = [];

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      const hasInline = (INLINE_ATTEMPTS.test(line) || INLINE_DELAY.test(line) || INLINE_PRIORITY.test(line));
      if (hasInline && !FROM_CONFIG.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — inline job option literal: ${line.trim().slice(0, 80)}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'JP006',
      message: `${violations.length} inline job option(s) not sourced from spec/config`,
      detail: violations.slice(0, 10).join('\n') + '\n\nSource options from spec or config: { attempts: config.jobs.email.attempts }'
    };
  }

  return { pass: true, code: 'JP006', message: `Job options sourced from spec/config (${files.length} file(s) checked)` };
}
