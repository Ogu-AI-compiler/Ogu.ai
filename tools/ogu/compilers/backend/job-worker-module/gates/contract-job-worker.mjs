import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const artifactPath = join(dir, 'job-worker-artifact.json');
  if (!existsSync(artifactPath)) return { pass: false, code: 'JW009', message: 'job-worker-artifact.json not found' };
  let artifact;
  try { artifact = JSON.parse(readFileSync(artifactPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'JW009', message: `Invalid JSON: ${e.message}` }; }
  const required = ['ir_id', 'jobName', 'queueName', 'concurrency', 'attestation'];
  const missing = required.filter(k => !(k in artifact));
  if (missing.length) return { pass: false, code: 'JW009', message: `Missing: ${missing.join(', ')}` };
  if (!artifact.ir_id.startsWith('JOB_WORKER:')) return { pass: false, code: 'JW009', message: `ir_id must be JOB_WORKER:{jobName}` };
  if (!artifact.attestation?.hash) return { pass: false, code: 'JW009', message: 'attestation.hash missing' };
  return { pass: true, code: 'JW009', message: `Job worker contract valid — ${artifact.jobName}, concurrency: ${artifact.concurrency}` };
}
