import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'healthcheck-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'HC001', message: 'healthcheck-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'HC001', message: `healthcheck-spec.json is not valid JSON: ${e.message}` };
  }

  const required = ['dependencies'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'HC001',
      message: `healthcheck-spec.json missing: ${missing.join(', ')}`,
      detail: 'Required shape: { dependencies: [{name, type, timeoutMs, degradedMode?}], livenessChecks?: string[], readinessChecks?: string[] }'
    };
  }

  if (!Array.isArray(spec.dependencies)) {
    return { pass: false, code: 'HC001', message: 'dependencies must be an array' };
  }

  const validTypes = ['database', 'redis', 'http', 'queue', 'storage'];
  const violations = [];

  for (const dep of spec.dependencies) {
    if (!dep.name) violations.push(`Dependency missing name: ${JSON.stringify(dep)}`);
    if (!dep.type || !validTypes.includes(dep.type)) {
      violations.push(`Dependency "${dep.name}" type must be one of: ${validTypes.join(', ')}, got: "${dep.type}"`);
    }
    if (typeof dep.timeoutMs !== 'number' || dep.timeoutMs <= 0) {
      violations.push(`Dependency "${dep.name}" missing timeoutMs (positive number)`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'HC001', message: `${violations.length} spec error(s)`, detail: violations.join('\n') };
  }

  return {
    pass: true, code: 'HC001',
    message: `healthcheck-spec.json valid — ${spec.dependencies.length} dependency/dependencies`
  };
}
