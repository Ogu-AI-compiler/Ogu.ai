import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * SC005 — typed-responses
 * Every endpoint method must return a typed domain object, not raw any/unknown.
 * Checks: no `as any`, no `Promise<any>`, no `Promise<unknown>` as return type of client methods.
 */

const RAW_ANY_RETURN = /:\s*Promise\s*<\s*(?:any|unknown)\s*>/;
const AS_ANY = /\)\s*as\s+any\b/;
const JSON_PARSE_UNTYPED = /JSON\.parse\(.*\)\s*(?:as\s+any|;\s*$)/;

function collectClientFiles(dir) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git', '__tests__', 'tests'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.ts$/) && !e.name.match(/\.(test|spec|d)\./)) {
        files.push(join(d, e.name));
      }
    }
  }
  walk(dir);
  return files;
}

export async function run({ dir }) {
  const files = collectClientFiles(dir);

  if (files.length === 0) {
    return { pass: false, code: 'SC005', message: 'No TypeScript client files found' };
  }

  const violations = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
      if (RAW_ANY_RETURN.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — Promise<any|unknown> return type`);
      }
      if (AS_ANY.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — cast to any`);
      }
      if (JSON_PARSE_UNTYPED.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — JSON.parse without type assertion`);
      }
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'SC005',
      message: `${violations.length} untyped response(s) found`,
      detail: violations.slice(0, 10).join('\n')
    };
  }

  return { pass: true, code: 'SC005', message: `All responses typed — no raw any/unknown (${files.length} file(s) checked)` };
}
