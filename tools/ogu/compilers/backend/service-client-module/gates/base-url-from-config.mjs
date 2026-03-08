import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SC003 — base-url-from-config
 * No hardcoded https:// or http:// base URLs in client files.
 * Base URL must be injected from config/env, not a string literal.
 */

const HARDCODED_URL = /['"`](https?:\/\/[a-z0-9.-]+\.[a-z]{2,})['"` ]/i;
// Allow localhost and test URLs
const ALLOWED_PATTERN = /localhost|127\.0\.0\.1|0\.0\.0\.0|example\.com|test\.|mock\./i;

function collectFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git', '__tests__', 'tests', 'spec'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(ts|mjs|js)$/) && !e.name.match(/\.(test|spec)\./)) {
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
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      const m = HARDCODED_URL.exec(line);
      if (m && !ALLOWED_PATTERN.test(m[1])) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — hardcoded URL: ${m[1]}`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SC003',
      message: `${violations.length} hardcoded base URL(s) found`,
      detail: violations.slice(0, 10).join('\n')
    };
  }

  return { pass: true, code: 'SC003', message: `No hardcoded base URLs — all from config (${files.length} file(s) checked)` };
}
