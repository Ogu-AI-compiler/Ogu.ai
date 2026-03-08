import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'transaction-spec.json');
  if (!existsSync(specPath)) {
    return { pass: false, code: 'TX001', message: 'transaction-spec.json not found' };
  }
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'TX001', message: `transaction-spec.json is not valid JSON: ${e.message}` }; }

  const required = ['name', 'writes', 'orm'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) {
    return {
      pass: false, code: 'TX001',
      message: `transaction-spec.json missing: ${missing.join(', ')}`,
      detail: 'Required shape: { name: string, orm: "prisma"|"drizzle"|"knex", writes: [{entity, operation}], isolationLevel?: string, idempotencyKey?: string }'
    };
  }

  if (!Array.isArray(spec.writes) || spec.writes.length < 2) {
    return {
      pass: false, code: 'TX001',
      message: 'Transaction script requires at least 2 write operations — use domain-service for single writes'
    };
  }

  const validOrms = ['prisma', 'drizzle', 'knex', 'typeorm'];
  if (!validOrms.includes(spec.orm)) {
    return { pass: false, code: 'TX001', message: `orm must be: ${validOrms.join('|')}, got: "${spec.orm}"` };
  }

  return {
    pass: true, code: 'TX001',
    message: `transaction-spec.json valid — "${spec.name}", ${spec.writes.length} write(s), orm: ${spec.orm}`
  };
}
