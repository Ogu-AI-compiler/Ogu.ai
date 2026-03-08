import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'client-runtime-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'SR001', message: 'client-runtime-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'SR001', message: `client-runtime-spec.json is not valid JSON: ${e.message}` };
  }

  const required = ['defaultTimeout', 'retryPolicy', 'secretHeaders'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'SR001',
      message: `client-runtime-spec.json missing required fields: ${missing.join(', ')}`,
      detail: 'Required shape: { defaultTimeout: number (ms), retryPolicy: { maxRetries, allowedMethods, allowedStatuses }, secretHeaders: string[] }'
    };
  }

  if (typeof spec.defaultTimeout !== 'number' || spec.defaultTimeout <= 0) {
    return { pass: false, code: 'SR001', message: 'defaultTimeout must be a positive number (milliseconds)' };
  }

  const retry = spec.retryPolicy;
  if (!retry || typeof retry.maxRetries !== 'number') {
    return { pass: false, code: 'SR001', message: 'retryPolicy.maxRetries must be a number' };
  }

  if (!Array.isArray(spec.secretHeaders)) {
    return { pass: false, code: 'SR001', message: 'secretHeaders must be an array of header names' };
  }

  return {
    pass: true, code: 'SR001',
    message: `client-runtime-spec.json valid — timeout: ${spec.defaultTimeout}ms, maxRetries: ${retry.maxRetries}`
  };
}
