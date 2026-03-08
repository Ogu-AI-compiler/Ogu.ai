import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * FS003 — entity-key-declared
 * Feature store feature groups must declare an entity key that identifies
 * the entity each row belongs to (user, product, session, etc.).
 *
 * Why:
 * - Feature stores serve features to training and serving pipelines by joining
 *   on entity keys. Without a declared entity key, features cannot be correctly
 *   retrieved for a given entity at prediction time.
 * - The entity key is the join predicate: when the serving pipeline calls
 *   feature_store.get_online_features(entity_rows=[{"user_id": 123}]),
 *   "user_id" must match what the feature group was registered with.
 * - Undeclared entity keys lead to: wrong-entity feature retrieval (returning
 *   user 456's features for user 123), full table scans instead of indexed
 *   lookups, and schema drift when entity semantics change silently.
 * - The entity key must be stable across feature versions — changing the
 *   entity key type or name is a breaking change requiring a version bump.
 *
 * Escape hatch: add "entityKeyExternal": true to feature-store-spec.json
 * if entity key is declared in a central schema registry (e.g., Feast registry).
 */

export async function run({ dir }) {
  const specPath = join(dir, 'feature-store-spec.json');

  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); }
  catch { return { pass: false, code: 'FS003', message: 'feature-store-spec.json not readable' }; }

  if (spec.entityKeyExternal === true) {
    return { pass: true, code: 'FS003', message: 'Entity key declared in central registry (external)', skipped: true };
  }

  if (!spec.entity_key) {
    return {
      pass: false, code: 'FS003',
      message: 'entity_key not declared in feature-store-spec.json',
      detail: 'Add to feature-store-spec.json:\n' +
        '  "entity_key": "user_id"\n' +
        '  OR "entity_key": ["user_id", "item_id"]  (composite entity)\n\n' +
        'Entity key must match the join key used when reading/serving features.',
    };
  }

  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  if (!pyFiles.length) {
    return { pass: true, code: 'FS003', message: `Entity key "${spec.entity_key}" declared in spec`, skipped: true };
  }

  const content = pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');
  const entityKey = String(spec.entity_key);

  const keyUsedInCode = content.includes(entityKey) ||
    /entity_key|join_key|primary_key/.test(content);

  if (!keyUsedInCode) {
    return {
      pass: false, code: 'FS003',
      message: `Entity key "${entityKey}" declared in spec but not referenced in Python code`,
      detail: 'Use the entity key when registering the feature group:\n' +
        `  entity = Entity(name="${entityKey}", value_type=ValueType.INT64)\n` +
        `  fs = FeatureGroup(entity_key="${entityKey}", ...)\n` +
        `  df.set_index("${entityKey}")`,
    };
  }

  return { pass: true, code: 'FS003', message: `Entity key "${entityKey}" declared and referenced in code` };
}
