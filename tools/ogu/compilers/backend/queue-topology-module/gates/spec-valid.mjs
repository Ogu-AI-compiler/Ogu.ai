import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'queue-topology-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'QT001', message: 'queue-topology-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'QT001', message: `queue-topology-spec.json is not valid JSON: ${e.message}` };
  }

  if (!Array.isArray(spec.queues) || spec.queues.length === 0) {
    return { pass: false, code: 'QT001', message: 'queues must be a non-empty array' };
  }

  const requiredQueueFields = ['name', 'owner'];
  const violations = [];

  for (const q of spec.queues) {
    const missing = requiredQueueFields.filter(f => !q[f]);
    if (missing.length) {
      violations.push(`Queue missing required fields ${missing.join(', ')}: ${JSON.stringify(q)}`);
    }
    if (q.name && !/^[a-z][a-z0-9-_]*$/.test(q.name)) {
      violations.push(`Queue name "${q.name}" must be lowercase alphanumeric with hyphens/underscores`);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'QT001',
      message: `${violations.length} queue spec error(s)`,
      detail: violations.join('\n')
    };
  }

  return {
    pass: true, code: 'QT001',
    message: `queue-topology-spec.json valid — ${spec.queues.length} queue(s) declared`
  };
}
