import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'cache-topology-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'CT001', message: 'cache-topology-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'CT001', message: `cache-topology-spec.json is not valid JSON: ${e.message}` };
  }

  if (!Array.isArray(spec.families) || spec.families.length === 0) {
    return { pass: false, code: 'CT001', message: 'families must be a non-empty array of cache families' };
  }

  const violations = [];
  for (const f of spec.families) {
    if (!f.name) violations.push(`Cache family missing name: ${JSON.stringify(f)}`);
    if (!f.namespace) violations.push(`Cache family "${f.name}" missing namespace`);
    if (!f.resource) violations.push(`Cache family "${f.name}" missing resource (source of truth entity)`);
  }

  if (violations.length) {
    return {
      pass: false, code: 'CT001',
      message: `${violations.length} cache family spec error(s)`,
      detail: violations.join('\n') + '\n\nRequired shape: { name, namespace, resource, ttl|noExpiry, serializer, keyInputs[] }'
    };
  }

  return {
    pass: true, code: 'CT001',
    message: `cache-topology-spec.json valid — ${spec.families.length} cache family/families`
  };
}
