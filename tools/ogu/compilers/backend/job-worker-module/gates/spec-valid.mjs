import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'job-worker-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'JW001', message: 'job-worker-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'JW001', message: `Invalid JSON: ${e.message}` }; }

  const required = ['jobName', 'queueName', 'payloadSchema', 'concurrency'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'JW001', message: `Missing: ${missing.join(', ')}`, detail: 'Required: { jobName, queueName, payloadSchema, concurrency: number, idempotencyKey?: string }' };
  if (typeof spec.concurrency !== 'number' || spec.concurrency < 1) return { pass: false, code: 'JW001', message: 'concurrency must be a positive number' };

  return { pass: true, code: 'JW001', message: `job-worker-spec.json valid — job: ${spec.jobName}, concurrency: ${spec.concurrency}` };
}
