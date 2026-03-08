import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * FS008 — contract-feature-store
 * Verifies that feature store modules satisfy the feature store contract:
 * entity key declared, version defined, no raw SQL construction, and all
 * features have dtype annotations.
 *
 * Why:
 * - entity_key is the join key for feature retrieval: without it, features
 *   cannot be correctly retrieved at prediction time, causing training-serving
 *   skew (training uses all data; serving retrieves the wrong entity's features).
 * - version is required for schema evolution: adding or changing features
 *   without bumping the version breaks downstream consumers silently.
 * - Raw SQL construction (f-string SQL) is a SQL injection vulnerability and
 *   also makes queries unparameterizable and uncacheable.
 * - dtype annotations enable automated type compatibility checks between
 *   the feature store schema and the model's expected input schema.
 *
 * Escape hatch: none — these are non-negotiable for production feature stores.
 */

const RULES = [
  {
    id: 'has-entity-key',
    description: 'entity_key defined in spec',
    test: (spec, _content) => !!(spec && spec.entity_key)
  },
  {
    id: 'has-version',
    description: 'version defined in spec',
    test: (spec, _content) => !!(spec && (spec.version || spec.version === 0))
  },
  {
    id: 'no-raw-sql-in-features',
    description: 'No raw SQL string construction (f-string SQL) in feature code',
    test: (_spec, content) => !/f["']SELECT.*FROM|f["']INSERT INTO|f["']UPDATE\s/i.test(content)
  },
  {
    id: 'features-have-dtype',
    description: 'All features have a dtype annotation',
    test: (spec, _content) => {
      if (!spec || !Array.isArray(spec.features)) return false;
      return spec.features.every(f => f.dtype);
    }
  },
];

export async function run({ dir }) {
  const specPath = join(dir, 'feature-store-spec.json');
  let spec = null;
  if (existsSync(specPath)) {
    try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch {}
  }

  const pyFiles = readdirSync(dir).filter(f => f.endsWith('.py'));
  const content = pyFiles.map(f => readFileSync(join(dir, f), 'utf8')).join('\n');

  const violations = RULES.filter(r => !r.test(spec, content));

  if (violations.length) {
    return {
      pass: false, code: 'FS008',
      message: `Contract violations: ${violations.map(v => v.id).join(', ')}`,
      detail: violations.map(v => `[${v.id}] ${v.description}`).join('\n')
    };
  }

  return { pass: true, code: 'FS008', message: 'All feature-store contract rules passed' };
}
