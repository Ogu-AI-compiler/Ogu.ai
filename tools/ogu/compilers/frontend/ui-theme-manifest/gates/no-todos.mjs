import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/** UTH007 — no-todos: no TODO/FIXME/HACK in theme spec files */

function collectFiles(dir) {
  const results = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.(json|mjs|js|ts)$/) && !f.name.match(/\.d\./)) {
        results.push(join(d, f.name));
      }
    }
  }
  walk(dir);
  return results;
}

export async function run({ dir }) {
  const files = collectFiles(dir);
  if (files.length === 0) {
    return { pass: true, code: 'UTH007', message: 'No files — gate skipped', skipped: true };
  }

  const violations = [];
  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    content.split('\n').forEach((line, i) => {
      if (/\b(?:TODO|FIXME|HACK)\b/.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — ${line.trim().slice(0, 60)}`);
      }
    });
  }

  if (violations.length > 0) {
    return { pass: false, code: 'UTH007', message: `${violations.length} TODO/FIXME/HACK found`, detail: violations.slice(0, 10).join('\n') };
  }

  return { pass: true, code: 'UTH007', message: `No TODO/FIXME/HACK (${files.length} file(s) checked)` };
}
