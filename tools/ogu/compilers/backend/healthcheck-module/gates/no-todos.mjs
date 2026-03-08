import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
function getAllFiles(dir) {
  const results = []; let entries; try { entries = readdirSync(dir,{withFileTypes:true}); } catch { return results; }
  for (const e of entries) { if (e.isDirectory()) { if (['node_modules','dist','.ogu','.git','coverage'].includes(e.name)) continue; results.push(...getAllFiles(join(dir,e.name))); } else if (e.name.match(/\.(ts|mjs|js)$/)) results.push(join(dir,e.name)); }
  return results;
}
export async function run({ dir }) {
  const pattern = /\b(TODO|FIXME|HACK|XXX)\b/; const violations = [];
  for (const file of getAllFiles(dir)) { const lines = readFileSync(file,'utf8').split('\n'); lines.forEach((line,i) => { if (pattern.test(line)) violations.push(`${file.replace(dir+'/','')}: ${i+1} — ${line.trim()}`); }); }
  if (violations.length) return { pass:false, code:'HC007', message:`${violations.length} TODO/FIXME/HACK comment(s) found`, detail:violations.join('\n') };
  return { pass:true, code:'HC007', message:'No TODO/FIXME/HACK comments found' };
}
