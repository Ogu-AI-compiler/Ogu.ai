import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
/** DS003 — no-any: explicit `any` types are forbidden in service modules */
const ANY_PATTERN = /:\s*any\b|<any>|as any\b|Array<any>|Promise<any>/;

function getAllTsFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.endsWith('.ts') && !f.name.includes('.d.ts') && !f.name.includes('.test.')) {
        results.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const files = getAllTsFiles(dir);
  if (files.length === 0) {
    return { pass: true, code: 'DS003', message: 'No TypeScript files found — no-any gate skipped', skipped: true };
  }

  const violations = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!line.trim().startsWith('//') && ANY_PATTERN.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}: ${i + 1} — ${line.trim().slice(0, 80)}`);
      }
    });
  }

  if (violations.length) {
    return { pass: false, code: 'DS003', message: `${violations.length} explicit 'any' type(s) found`, detail: violations.join('\n') };
  }
  return { pass: true, code: 'DS003', message: `No explicit any types (${files.length} file(s))` };
}
