import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/** QA029 — contract-e2e */

export async function run({ dir }) {
  const ap = join(dir, 'e2e-spec-artifact.json');
  if (!existsSync(ap)) return { pass: false, code: 'QA029', message: 'e2e-spec-artifact.json not found' };
  let a; try { a = JSON.parse(readFileSync(ap, 'utf8')); } catch (e) { return { pass: false, code: 'QA029', message: `Invalid JSON: ${e.message}` }; }
  const required = ['ir_id', 'framework', 'userFlows', 'criticalPaths', 'attestation'];
  const missing = required.filter(k => !(k in a));
  if (missing.length) return { pass: false, code: 'QA029', message: `Missing: ${missing.join(', ')}` };
  if (!a.ir_id.startsWith('E2E_SPEC:')) return { pass: false, code: 'QA029', message: 'ir_id must start with E2E_SPEC:' };
  if (!a.attestation?.hash) return { pass: false, code: 'QA029', message: 'attestation.hash missing' };
  return { pass: true, code: 'QA029', message: `E2E spec artifact valid — ${a.userFlows} flow(s), ${a.criticalPaths} critical` };
}
