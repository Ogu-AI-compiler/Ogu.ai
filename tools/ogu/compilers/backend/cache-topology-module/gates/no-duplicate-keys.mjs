import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * CT004 — no-duplicate-keys
 * No two cache families should produce keys for the same resource with the same inputs.
 * Duplicate key builders cause cache inconsistency — one write invalidates nothing for the other.
 */

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'cache-topology-spec.json'), 'utf8'));
  const violations = [];

  // Check for same resource + same keyInputs combination across families
  const resourceKeyMap = new Map();

  for (const f of spec.families) {
    if (!f.resource || !f.keyInputs) continue;

    const keySignature = `${f.resource}:${JSON.stringify([...(f.keyInputs || [])].sort())}`;

    if (resourceKeyMap.has(keySignature)) {
      const existing = resourceKeyMap.get(keySignature);
      violations.push(
        `Cache families "${existing}" and "${f.name}" both cache "${f.resource}" with the same key inputs [${f.keyInputs?.join(', ')}]`
      );
    } else {
      resourceKeyMap.set(keySignature, f.name);
    }
  }

  // Also check for same namespace (already caught by namespaces-valid, but belt-and-suspenders)
  const seen = new Map();
  for (const f of spec.families) {
    if (seen.has(f.namespace)) {
      violations.push(`Namespace collision: "${f.namespace}" used by both "${seen.get(f.namespace)}" and "${f.name}"`);
    }
    seen.set(f.namespace, f.name);
  }

  if (violations.length) {
    return {
      pass: false, code: 'CT004',
      message: `${violations.length} duplicate key builder(s) detected`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'CT004', message: 'No duplicate cache key builders detected' };
}
