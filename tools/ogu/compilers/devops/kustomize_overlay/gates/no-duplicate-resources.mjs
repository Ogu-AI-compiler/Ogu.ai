/**
 * Gate: no-duplicate-resources (KO004)
 * Validates that no two resources in the spec share the same kind/name
 * combination. Duplicate resource IDs cause kustomize to emit conflicting
 * manifests which kubectl will reject with a "already exists" error, or
 * silently overwrite one resource with another.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec      = JSON.parse(readFileSync(join(dir, 'kustomize-spec.json'), 'utf8'));
  const resources = spec.resources || [];

  const seen       = new Map();
  const violations = [];

  for (const r of resources) {
    const key = `${r.kind}/${r.name}`;
    if (seen.has(key)) {
      violations.push({ kind: r.kind, name: r.name, reason: `Duplicate resource ID "${key}" — only one instance allowed per kind/name combination` });
    } else {
      seen.set(key, true);
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'KO004',
      message: `${violations.length} duplicate resource ID(s) found`,
      detail: { violations, hint: 'Each kind/name combination must be unique within the overlay resource list' },
    };
  }

  return { pass: true, code: 'KO004', message: 'No duplicate resource IDs' };
}
