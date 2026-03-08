import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'job-producer-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'JP001', message: 'job-producer-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'JP001', message: `job-producer-spec.json is not valid JSON: ${e.message}` };
  }

  const required = ['jobName', 'queueName', 'payloadSchema'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'JP001',
      message: `job-producer-spec.json missing: ${missing.join(', ')}`,
      detail: 'Required: { jobName: string, queueName: string, payloadSchema: string (zod schema name), options?: { attempts, delay, priority } }'
    };
  }

  if (typeof spec.payloadSchema !== 'string' || spec.payloadSchema.length === 0) {
    return { pass: false, code: 'JP001', message: 'payloadSchema must be a non-empty string (zod/joi schema variable name)' };
  }

  return {
    pass: true, code: 'JP001',
    message: `job-producer-spec.json valid — job: ${spec.jobName}, queue: ${spec.queueName}, schema: ${spec.payloadSchema}`
  };
}
