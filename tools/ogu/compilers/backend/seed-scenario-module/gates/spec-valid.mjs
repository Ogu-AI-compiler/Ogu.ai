import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export async function run({ dir }) {
  const specPath = join(dir, 'seed-scenario-spec.json');
  if (!existsSync(specPath)) return { pass: false, code: 'SS001', message: 'seed-scenario-spec.json not found' };
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch (e) { return { pass: false, code: 'SS001', message: `Invalid JSON: ${e.message}` }; }
  const required = ['scenarioId', 'description', 'entities', 'seedOrder'];
  const missing = required.filter(k => !(k in spec));
  if (missing.length) return { pass: false, code: 'SS001', message: `Missing: ${missing.join(', ')}`, detail: 'Required: { scenarioId, description, entities: string[], seedOrder: string[] (entity order respecting FK deps) }' };
  if (!Array.isArray(spec.entities) || spec.entities.length === 0) return { pass: false, code: 'SS001', message: 'entities must be a non-empty array' };
  if (!Array.isArray(spec.seedOrder) || spec.seedOrder.length === 0) return { pass: false, code: 'SS001', message: 'seedOrder must be a non-empty array (defines FK-safe insertion order)' };
  // Verify seedOrder covers all entities
  const missing_from_order = spec.entities.filter(e => !spec.seedOrder.includes(e));
  if (missing_from_order.length) return { pass: false, code: 'SS001', message: `Entities not in seedOrder: ${missing_from_order.join(', ')}` };
  return { pass: true, code: 'SS001', message: `seed-scenario-spec.json valid — ${spec.scenarioId}, entities: [${spec.entities.join(', ')}]` };
}
