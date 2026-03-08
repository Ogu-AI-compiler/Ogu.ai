import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/** SH008 — no-todos: no TODO/FIXME/HACK in policy files or source code in this artifact directory */
export async function run({ dir }) {
  const files = [];

  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of entries) {
      if (f.isDirectory()) {
        if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name));
      } else if (f.name.match(/\.(ts|mjs|js|json)$/) && !f.name.match(/\.d\./)) {
        files.push(join(d, f.name));
      }
    }
  }

  walk(dir);

  if (files.length === 0) {
    return { pass: true, code: 'SH008', message: 'No files found — gate skipped', skipped: true };
  }

  const violations = [];
  for (const file of files) {
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    content.split('\n').forEach((line, i) => {
      if (/\b(?:TODO|FIXME|HACK)\b/.test(line)) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — ${line.trim().slice(0, 80)}`);
      }
    });
  }

  if (violations.length) {
    return {
      pass: false,
      code: 'SH008',
      message: `${violations.length} TODO/FIXME/HACK comment(s) found`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'SH008', message: `No TODO/FIXME/HACK (${files.length} file(s) scanned)` };
}
