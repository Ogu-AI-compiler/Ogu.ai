import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const artifactPath = join(dir, 'job-producer-artifact.json');
  if (!existsSync(artifactPath)) return { pass: false, code: 'JP009', message: 'job-producer-artifact.json not found — run compiler first' };
  let artifact;
  try { artifact = JSON.parse(readFileSync(artifactPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'JP009', message: `Invalid JSON: ${e.message}` }; }
  const required = ['ir_id', 'jobName', 'queueName', 'payloadSchema', 'attestation'];
  const missing = required.filter(k => !(k in artifact));
  if (missing.length) return { pass: false, code: 'JP009', message: `Missing fields: ${missing.join(', ')}` };
  if (!artifact.ir_id.startsWith('JOB_PRODUCER:')) return { pass: false, code: 'JP009', message: `ir_id must be JOB_PRODUCER:{jobName}, got: "${artifact.ir_id}"` };
  if (!artifact.attestation?.hash) return { pass: false, code: 'JP009', message: 'attestation.hash missing' };
  return { pass: true, code: 'JP009', message: `Job producer contract valid — ${artifact.jobName} → ${artifact.queueName}` };
}
