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
    const lines = readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/\b(?:TODO|FIXME|HACK)\b/.test(lines[i])) violations.push(`${file.replace(dir + '/', '')}:${i + 1} — ${lines[i].trim().slice(0, 60)}`);
    }
  }
  if (violations.length) return { pass: false, code: 'JW007', message: `${violations.length} TODO/FIXME/HACK`, detail: violations.slice(0, 10).join('\n') };
  return { pass: true, code: 'JW007', message: `No TODO/FIXME/HACK (${files.length} file(s))` };
}
