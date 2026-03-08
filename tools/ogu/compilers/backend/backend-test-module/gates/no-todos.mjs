import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const files = [];
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
        walk(join(d, e.name));
      } else if (e.name.match(/\.(ts|mjs|js)$/) && !e.name.match(/\.d\./)) {
        files.push(join(d, e.name));
      }
    }
  }
  walk(dir);

  const violations = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/\b(?:TODO|FIXME|HACK)\b/.test(lines[i])) {
        violations.push(`${file.replace(dir + '/', '')}:${i + 1} — ${lines[i].trim().slice(0, 60)}`);
      }
    }
  }

  if (violations.length) {
    return { pass: false, code: 'BT007', message: `${violations.length} TODO/FIXME/HACK comment(s) found`, detail: violations.slice(0, 10).join('\n') };
  }
  return { pass: true, code: 'BT007', message: `No TODO/FIXME/HACK comments (${files.length} file(s) checked)` };
}
