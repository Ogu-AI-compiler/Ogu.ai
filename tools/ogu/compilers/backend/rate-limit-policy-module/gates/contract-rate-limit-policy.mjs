import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const ap = join(dir, 'rate-limit-policy-artifact.json');
  if (!existsSync(ap)) return { pass: false, code: 'RL007', message: 'rate-limit-policy-artifact.json not found' };
  let a; try { a = JSON.parse(readFileSync(ap, 'utf8')); } catch (e) { return { pass: false, code: 'RL007', message: `Invalid JSON: ${e.message}` }; }
  const missing = ['ir_id','policyId','scope','quota','windowSeconds','strategy','attestation'].filter(k=>!(k in a));
  if (missing.length) return { pass: false, code: 'RL007', message: `Missing: ${missing.join(', ')}` };
  if (!a.ir_id.startsWith('RATE_LIMIT_POLICY:')) return { pass: false, code: 'RL007', message: 'ir_id must be RATE_LIMIT_POLICY:{policyId}' };
  if (!a.attestation?.hash) return { pass: false, code: 'RL007', message: 'attestation.hash missing' };
  return { pass: true, code: 'RL007', message: `Rate limit policy contract valid — ${a.policyId}: ${a.quota}/${a.windowSeconds}s by ${a.scope}` };
}
