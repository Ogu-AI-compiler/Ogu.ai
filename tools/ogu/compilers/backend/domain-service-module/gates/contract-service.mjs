import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const p=join(new URL('.',import.meta.url).pathname,'..','contracts','service.contract.json');
  if(!existsSync(p))return{pass:false,code:'DS011',message:'service.contract.json not found'};
  const contract=JSON.parse(readFileSync(p,'utf8'));
  const spec=JSON.parse(readFileSync(join(dir,'service-spec.json'),'utf8'));
  const v=[];
  for(const rule of contract.rules){
    if(rule.id==='SVC-001'&&(!spec.name||typeof spec.name!=='string'))v.push(`[${rule.id}] ${rule.description}`);
    if(rule.id==='SVC-002'&&(!spec.useCases||spec.useCases.length===0))v.push(`[${rule.id}] ${rule.description}`);
    if(rule.id==='SVC-003'&&(!spec.dependencies||!Array.isArray(spec.dependencies)))v.push(`[${rule.id}] ${rule.description}`);
    if(rule.id==='SVC-004'){const idempotent=spec.useCases.filter(uc=>uc.idempotent&&!uc.dedupeStrategy);if(idempotent.length)v.push(`[${rule.id}] ${rule.description}: ${idempotent.map(uc=>uc.name).join(', ')}`);}
  }
  if(v.length)return{pass:false,code:'DS011',message:`${v.length} contract violation(s)`,detail:v.join('\n')};
  return{pass:true,code:'DS011',message:'All service contract rules satisfied'};
}
