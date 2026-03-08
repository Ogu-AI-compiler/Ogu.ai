import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const artifactPath = join(dir, 'event-consumer-artifact.json');
  if (!existsSync(artifactPath)) return { pass: false, code: 'EC009', message: 'event-consumer-artifact.json not found' };
  let artifact;
  try { artifact = JSON.parse(readFileSync(artifactPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'EC009', message: `Invalid JSON: ${e.message}` }; }
  const required = ['ir_id', 'eventType', 'channels', 'handlerName', 'attestation'];
  const missing = required.filter(k => !(k in artifact));
  if (missing.length) return { pass: false, code: 'EC009', message: `Missing: ${missing.join(', ')}` };
  if (!artifact.ir_id.startsWith('EVENT_CONSUMER:')) return { pass: false, code: 'EC009', message: `ir_id must be EVENT_CONSUMER:{eventType}` };
  if (!artifact.attestation?.hash) return { pass: false, code: 'EC009', message: 'attestation.hash missing' };
  return { pass: true, code: 'EC009', message: `Event consumer contract valid — ${artifact.eventType}, channels: [${artifact.channels.join(', ')}]` };
}
