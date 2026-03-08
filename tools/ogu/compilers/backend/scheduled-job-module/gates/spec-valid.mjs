import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'scheduled-job-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'SJ001', message: 'scheduled-job-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'SJ001', message: `Invalid JSON: ${e.message}` }; }
  const required = ['jobId', 'cronExpression', 'timezone', 'description'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'SJ001', message: `Missing: ${missing.join(', ')}`, detail: 'Required: { jobId: string (stable constant), cronExpression, timezone, description }' };
  if (typeof spec.jobId !== 'string' || !/^[a-z][a-z0-9-_]+$/.test(spec.jobId)) return { pass: false, code: 'SJ001', message: `jobId must be a stable kebab-case string, got: "${spec.jobId}"` };
  return { pass: true, code: 'SJ001', message: `scheduled-job-spec.json valid — id: ${spec.jobId}, cron: ${spec.cronExpression}` };
}
