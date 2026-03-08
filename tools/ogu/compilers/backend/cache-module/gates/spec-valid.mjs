import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'cache-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'CA001', message: 'cache-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'CA001', message: `cache-spec.json is not valid JSON: ${e.message}` };
  }

  const required = ['family', 'namespace', 'keyInputs', 'pattern'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'CA001',
      message: `cache-spec.json missing: ${missing.join(', ')}`,
      detail: 'Required: { family: string, namespace: string, keyInputs: string[], pattern: "read-through"|"write-through"|"cache-aside", invalidates?: string[] }'
    };
  }

  const validPatterns = ['read-through', 'write-through', 'cache-aside'];
  if (!validPatterns.includes(spec.pattern)) {
    return { pass: false, code: 'CA001', message: `pattern must be one of: ${validPatterns.join(', ')}, got: "${spec.pattern}"` };
  }

  if (!Array.isArray(spec.keyInputs) || spec.keyInputs.length === 0) {
    return { pass: false, code: 'CA001', message: 'keyInputs must be a non-empty array of parameter names' };
  }

  if (spec.invalidates && !Array.isArray(spec.invalidates)) {
    return { pass: false, code: 'CA001', message: 'invalidates must be an array of namespace strings' };
  }

  return {
    pass: true, code: 'CA001',
    message: `cache-spec.json valid — family: ${spec.family}, namespace: ${spec.namespace}, pattern: ${spec.pattern}, keyInputs: [${spec.keyInputs.join(', ')}]`
  };
}
