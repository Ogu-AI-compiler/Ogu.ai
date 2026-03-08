import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function getAllTsFiles(dir) {
  const results = [];
  function walk(d) {
    let e; try { e = readdirSync(d,{withFileTypes:true}); } catch { return; }
    for (const f of e) { if (f.isDirectory()) { if (['node_modules','dist','.git'].includes(f.name)) continue; walk(join(d,f.name)); } else if (f.name.endsWith('.ts') && !f.name.includes('.d.ts') && !f.name.includes('.test.')) results.push(join(d,f.name)); }
  }
  walk(dir); return results;
}

export async function run({ dir }) {
  const ANY_PATTERN = /:\s*any\b|<any>|as any\b|Array<any>|Promise<any>/;
  const violations = [];

  for (const file of getAllTsFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//')) return;
      if (ANY_PATTERN.test(line)) {
        violations.push(`${file.replace(dir+'/','')}: ${i+1} — explicit 'any': ${trimmed.slice(0,80)}`);
      }
    });
  }

  if (violations.length) {
    return { pass: false, code: 'OR004', message: `${violations.length} explicit 'any' type(s) found`, detail: violations.join('\n') };
  }

  return { pass: true, code: 'OR004', message: 'No explicit any types found' };
}
