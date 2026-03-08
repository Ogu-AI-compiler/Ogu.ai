import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'cache-topology-spec.json'), 'utf8'));
  const violations = [];
  const seenNamespaces = new Set();
  const namespacePattern = /^[a-z][a-z0-9:-]*$/;

  for (const f of spec.families) {
    if (!f.namespace) {
      violations.push(`Cache family "${f.name}" has no namespace`);
      continue;
    }

    if (!namespacePattern.test(f.namespace)) {
      violations.push(`Cache family "${f.name}" namespace "${f.namespace}" must be lowercase with hyphens/colons (e.g. "user:profile")`);
    }

    if (seenNamespaces.has(f.namespace)) {
      violations.push(`Duplicate namespace "${f.namespace}" — each cache family must have a unique namespace`);
    }
    seenNamespaces.add(f.namespace);
  }

  if (violations.length) {
    return {
      pass: false, code: 'CT002',
      message: `${violations.length} namespace error(s)`,
      detail: violations.join('\n')
    };
  }

  return { pass: true, code: 'CT002', message: `All ${spec.families.length} cache namespace(s) are valid and unique` };
}
