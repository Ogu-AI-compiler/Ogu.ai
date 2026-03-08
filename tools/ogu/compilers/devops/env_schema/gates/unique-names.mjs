/**
 * Gate: unique-names (ES002)
 * Ensures that no two envKeys share the same name. Duplicate env var names cause
 * runtime ambiguity — the last declaration silently wins and the schema contract
 * becomes unreliable.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec  = JSON.parse(readFileSync(join(dir, 'env-schema-spec.json'), 'utf8'));
  const names = spec.envKeys.map(k => k.name);
  const seen  = new Set();
  const dupes = [];

  for (const n of names) {
    if (seen.has(n)) dupes.push(n);
    seen.add(n);
  }

  if (dupes.length) {
    return {
      pass: false, code: 'ES002',
      message: `Duplicate env key names: ${dupes.join(', ')}`,
      detail: {
        duplicates: [...new Set(dupes)],
        hint: 'Each entry in envKeys must have a unique name — remove or merge the duplicate definitions',
      },
    };
  }

  return { pass: true, code: 'ES002', message: `All ${names.length} key names are unique` };
}
