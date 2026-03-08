import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const ap = join(dir, 'webhook-processor-artifact.json');
  if (!existsSync(ap)) return { pass: false, code: 'WH008', message: 'webhook-processor-artifact.json not found' };
  let a; try { a = JSON.parse(readFileSync(ap, 'utf8')); } catch (e) { return { pass: false, code: 'WH008', message: `Invalid JSON: ${e.message}` }; }
  const missing = ['ir_id','provider','signatureAlgorithm','attestation'].filter(k => !(k in a));
  if (missing.length) return { pass: false, code: 'WH008', message: `Missing: ${missing.join(', ')}` };
  if (!a.ir_id.startsWith('WEBHOOK_PROCESSOR:')) return { pass: false, code: 'WH008', message: `ir_id must be WEBHOOK_PROCESSOR:{provider}` };
  if (!a.attestation?.hash) return { pass: false, code: 'WH008', message: 'attestation.hash missing' };
  return { pass: true, code: 'WH008', message: `Webhook processor contract valid — ${a.provider} (${a.signatureAlgorithm})` };
}
