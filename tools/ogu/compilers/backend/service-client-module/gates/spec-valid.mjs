import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'service-client-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'SC001', message: 'service-client-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'SC001', message: `service-client-spec.json is not valid JSON: ${e.message}` };
  }

  const required = ['provider', 'baseUrlConfigKey', 'endpoints', 'auth'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'SC001',
      message: `service-client-spec.json missing: ${missing.join(', ')}`,
      detail: 'Required: { provider: string, baseUrlConfigKey: string, auth: { type: "bearer"|"apiKey"|"none", headerKey? }, endpoints: [{name, method, path, returns}] }'
    };
  }

  const validAuthTypes = ['bearer', 'apiKey', 'basic', 'none'];
  if (!validAuthTypes.includes(spec.auth?.type)) {
    return { pass: false, code: 'SC001', message: `auth.type must be one of: ${validAuthTypes.join(', ')}, got: "${spec.auth?.type}"` };
  }

  if (['bearer', 'apiKey'].includes(spec.auth?.type) && !spec.auth?.headerKey) {
    return { pass: false, code: 'SC001', message: `auth.headerKey required when auth.type is "${spec.auth.type}"` };
  }

  if (!Array.isArray(spec.endpoints) || spec.endpoints.length === 0) {
    return { pass: false, code: 'SC001', message: 'endpoints must be a non-empty array' };
  }

  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const violations = [];
  for (const ep of spec.endpoints) {
    if (!ep.name) violations.push(`Endpoint missing name: ${JSON.stringify(ep)}`);
    if (!validMethods.includes(ep.method?.toUpperCase())) violations.push(`Endpoint "${ep.name}" has invalid method: "${ep.method}"`);
    if (!ep.path) violations.push(`Endpoint "${ep.name}" missing path`);
    if (!ep.returns) violations.push(`Endpoint "${ep.name}" missing returns type`);
  }

  if (violations.length) {
    return { pass: false, code: 'SC001', message: `${violations.length} endpoint spec error(s)`, detail: violations.join('\n') };
  }

  return {
    pass: true, code: 'SC001',
    message: `service-client-spec.json valid — provider: ${spec.provider}, ${spec.endpoints.length} endpoint(s), auth: ${spec.auth.type}`
  };
}
