import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const artifactPath = join(dir, 'event-publisher-artifact.json');
  if (!existsSync(artifactPath)) return { pass: false, code: 'EP008', message: 'event-publisher-artifact.json not found' };
  let artifact;
  try { artifact = JSON.parse(readFileSync(artifactPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'EP008', message: `Invalid JSON: ${e.message}` }; }
  const required = ['ir_id', 'eventType', 'channel', 'attestation'];
  const missing = required.filter(k => !(k in artifact));
  if (missing.length) return { pass: false, code: 'EP008', message: `Missing: ${missing.join(', ')}` };
  if (!artifact.ir_id.startsWith('EVENT_PUBLISHER:')) return { pass: false, code: 'EP008', message: `ir_id must be EVENT_PUBLISHER:{eventType}` };
  if (!artifact.attestation?.hash) return { pass: false, code: 'EP008', message: 'attestation.hash missing' };
  return { pass: true, code: 'EP008', message: `Event publisher contract valid — ${artifact.eventType} → ${artifact.channel}` };
}
