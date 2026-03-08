import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
function getAllFiles(dir) { const r=[]; let e; try{e=readdirSync(dir,{withFileTypes:true});}catch{return r;} for(const f of e){if(f.isDirectory()){if(['node_modules','dist','.ogu','.git','coverage'].includes(f.name))continue;r.push(...getAllFiles(join(dir,f.name)));}else if(f.name.match(/\.(ts|mjs|js)$/))r.push(join(dir,f.name));} return r; }
export async function run({ dir }) {
  const p=/\b(TODO|FIXME|HACK|XXX)\b/; const v=[];
  for(const file of getAllFiles(dir)){const lines=readFileSync(file,'utf8').split('\n');lines.forEach((line,i)=>{if(p.test(line))v.push(`${file.replace(dir+'/','')}: ${i+1} — ${line.trim()}`);});}
  if(v.length)return{pass:false,code:'OR010',message:`${v.length} TODO/FIXME/HACK comment(s) found`,detail:v.join('\n')};
  return{pass:true,code:'OR010',message:'No TODO/FIXME/HACK comments found'};
}
