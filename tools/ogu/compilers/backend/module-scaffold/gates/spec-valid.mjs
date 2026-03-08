import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const VALID_CAPABILITIES = [
  'services', 'repositories', 'workflows', 'clients',
  'events', 'jobs', 'webhooks', 'cache', 'graphql',
];

export async function run({ dir }) {
  const specPath = join(dir, 'module-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'MS001', message: 'module-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'MS001', message: `module-spec.json is not valid JSON: ${e.message}` };
  }

  const required = ['name', 'capabilities'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'MS001',
      message: `module-spec.json missing required fields: ${missing.join(', ')}`,
      detail: `Required shape: { name: string, capabilities: Array<${VALID_CAPABILITIES.join('|')}>, allowedImports?: string[] }`
    };
  }

  if (!Array.isArray(spec.capabilities)) {
    return { pass: false, code: 'MS001', message: 'capabilities must be an array' };
  }

  const invalidCaps = spec.capabilities.filter(c => !VALID_CAPABILITIES.includes(c));
  if (invalidCaps.length) {
    return {
      pass: false, code: 'MS001',
      message: `Invalid capabilities: ${invalidCaps.join(', ')}`,
      detail: `Valid capabilities: ${VALID_CAPABILITIES.join(', ')}`
    };
  }

  if (!spec.name || typeof spec.name !== 'string') {
    return { pass: false, code: 'MS001', message: 'module name must be a non-empty string' };
  }

  return {
    pass: true, code: 'MS001',
    message: `module-spec.json valid — module: "${spec.name}", capabilities: ${spec.capabilities.join(', ')}`
  };
}
