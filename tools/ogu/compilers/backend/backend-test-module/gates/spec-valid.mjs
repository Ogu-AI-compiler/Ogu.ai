import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'test-module-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'BT001', message: 'test-module-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'BT001', message: `test-module-spec.json is not valid JSON: ${e.message}` };
  }

  const required = ['module', 'scenarios'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'BT001',
      message: `test-module-spec.json missing: ${missing.join(', ')}`,
      detail: 'Required: { module: string, scenarios: [{ id: string, description: string, given?, when, then }] }'
    };
  }

  if (!Array.isArray(spec.scenarios) || spec.scenarios.length === 0) {
    return { pass: false, code: 'BT001', message: 'scenarios must be a non-empty array' };
  }

  const violations = [];
  for (const s of spec.scenarios) {
    if (!s.id) violations.push(`Scenario missing id: ${JSON.stringify(s).slice(0, 60)}`);
    if (!s.description) violations.push(`Scenario "${s.id}" missing description`);
    if (!s.when) violations.push(`Scenario "${s.id}" missing when (action under test)`);
    if (!s.then) violations.push(`Scenario "${s.id}" missing then (expected outcome)`);
  }

  if (violations.length) {
    return { pass: false, code: 'BT001', message: `${violations.length} scenario spec error(s)`, detail: violations.join('\n') };
  }

  return {
    pass: true, code: 'BT001',
    message: `test-module-spec.json valid — module: ${spec.module}, ${spec.scenarios.length} scenario(s)`
  };
}
