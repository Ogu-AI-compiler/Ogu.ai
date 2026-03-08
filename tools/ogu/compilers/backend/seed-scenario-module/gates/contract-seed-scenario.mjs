import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const ap = join(dir, 'seed-scenario-artifact.json');
  if (!existsSync(ap)) return { pass: false, code: 'SS008', message: 'seed-scenario-artifact.json not found' };
  let a; try { a = JSON.parse(readFileSync(ap, 'utf8')); } catch (e) { return { pass: false, code: 'SS008', message: `Invalid JSON: ${e.message}` }; }
  const missing = ['ir_id','scenarioId','entities','seedOrder','attestation'].filter(k=>!(k in a));
  if (missing.length) return { pass: false, code: 'SS008', message: `Missing: ${missing.join(', ')}` };
  if (!a.ir_id.startsWith('SEED_SCENARIO:')) return { pass: false, code: 'SS008', message: 'ir_id must be SEED_SCENARIO:{scenarioId}' };
  if (!a.attestation?.hash) return { pass: false, code: 'SS008', message: 'attestation.hash missing' };
  return { pass: true, code: 'SS008', message: `Seed scenario contract valid — ${a.scenarioId}, ${a.entities.length} entities` };
}
