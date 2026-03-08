import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const files = [];
  function walk(d) {
    let e; try { e = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const f of e) {
      if (f.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(f.name)) walk(join(d, f.name)); }
      else if (f.name.match(/\.(ts|mjs|js)$/) && !f.name.match(/\.d\./)) files.push(join(d, f.name));
    }
  }
  walk(dir);
  const violations = [];
  for (const file of files) {
    readFileSync(file, 'utf8').split('\n').forEach((l, i) => {
      if (/\b(?:TODO|FIXME|HACK)\b/.test(l)) violations.push(`${file.replace(dir + '/', '')}:${i + 1} — ${l.trim().slice(0, 60)}`);
    });
  }
  if (violations.length) return { pass: false, code: 'EP006', message: `${violations.length} TODO/FIXME/HACK`, detail: violations.slice(0, 10).join('\n') };
  return { pass: true, code: 'EP006', message: `No TODO/FIXME/HACK (${files.length} file(s))` };
}
