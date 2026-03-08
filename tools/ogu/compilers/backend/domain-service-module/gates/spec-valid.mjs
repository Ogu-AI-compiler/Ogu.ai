import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'service-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'DS001', message: 'service-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'DS001', message: `service-spec.json is not valid JSON: ${e.message}` };
  }

  const required = ['name', 'useCases', 'dependencies'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'DS001',
      message: `service-spec.json missing: ${missing.join(', ')}`,
      detail: 'Required shape: { name: string, useCases: [{name, idempotent?, multiWrite?}], dependencies: [{name, type}] }'
    };
  }

  if (!Array.isArray(spec.useCases) || spec.useCases.length === 0) {
    return { pass: false, code: 'DS001', message: 'useCases must be a non-empty array' };
  }

  if (!Array.isArray(spec.dependencies)) {
    return { pass: false, code: 'DS001', message: 'dependencies must be an array' };
  }

  const validDepTypes = ['repository', 'service-client', 'cache', 'event-publisher', 'config', 'queue-producer'];
  const violations = [];
  for (const dep of spec.dependencies) {
    if (!dep.name) violations.push(`Dependency missing name: ${JSON.stringify(dep)}`);
    if (dep.type && !validDepTypes.includes(dep.type)) {
      violations.push(`Dependency "${dep.name}" type "${dep.type}" must be: ${validDepTypes.join('|')}`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'DS001', message: `${violations.length} spec error(s)`, detail: violations.join('\n') };
  }

  return {
    pass: true, code: 'DS001',
    message: `service-spec.json valid — service: "${spec.name}", ${spec.useCases.length} use case(s), ${spec.dependencies.length} dep(s)`
  };
}
