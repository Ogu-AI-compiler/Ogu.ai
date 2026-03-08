import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'repository-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'OR001', message: 'repository-spec.json not found' };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    return { pass: false, code: 'OR001', message: `repository-spec.json is not valid JSON: ${e.message}` };
  }

  const required = ['entity', 'methods', 'orm'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'OR001',
      message: `repository-spec.json missing: ${missing.join(', ')}`,
      detail: 'Required shape: { entity: string, orm: "prisma"|"drizzle"|"knex", methods: [{name, type: "read"|"write"|"delete", paginated?, returns}] }'
    };
  }

  const validOrms = ['prisma', 'drizzle', 'knex', 'typeorm'];
  if (!validOrms.includes(spec.orm)) {
    return { pass: false, code: 'OR001', message: `orm must be one of: ${validOrms.join(', ')}, got: "${spec.orm}"` };
  }

  if (!Array.isArray(spec.methods) || spec.methods.length === 0) {
    return { pass: false, code: 'OR001', message: 'methods must be a non-empty array' };
  }

  const validMethodTypes = ['read', 'write', 'delete'];
  const violations = [];
  for (const m of spec.methods) {
    if (!m.name) violations.push(`Method missing name: ${JSON.stringify(m)}`);
    if (!validMethodTypes.includes(m.type)) {
      violations.push(`Method "${m.name}" type must be: ${validMethodTypes.join('|')}, got: "${m.type}"`);
    }
  }

  if (violations.length) {
    return { pass: false, code: 'OR001', message: `${violations.length} method spec error(s)`, detail: violations.join('\n') };
  }

  return {
    pass: true, code: 'OR001',
    message: `repository-spec.json valid — entity: ${spec.entity}, orm: ${spec.orm}, ${spec.methods.length} method(s)`
  };
}
