import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** CTS005 — reference-integrity: reference fields point to existing types; no circular dependencies */
export async function run({ dir }) {
  const specPath = join(dir, 'content-type-schema.spec.json');

  if (!existsSync(specPath)) {
    return { pass: true, code: 'CTS005', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'CTS005', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  if (!Array.isArray(spec.types) || spec.types.length === 0) {
    return { pass: true, code: 'CTS005', message: 'No types defined — gate skipped', skipped: true };
  }

  const typeIds = new Set(spec.types.map(t => t.id).filter(Boolean));
  const violations = [];

  // Check that reference fields point to existing types
  for (const type of spec.types) {
    if (!Array.isArray(type.fields)) continue;

    for (const field of type.fields) {
      if (field.type === 'reference') {
        if (!field.referenceTo) {
          violations.push(`"${type.id}.${field.name}": reference field missing referenceTo`);
        } else if (!typeIds.has(field.referenceTo)) {
          violations.push(
            `"${type.id}.${field.name}": referenceTo "${field.referenceTo}" is not a defined content type`
          );
        }
      }
    }
  }

  // Check for circular references using DFS
  // Build adjacency list: type → referenced types
  const graph = new Map();
  for (const type of spec.types) {
    const refs = (type.fields || [])
      .filter(f => f.type === 'reference' && f.referenceTo && !f.bidirectional)
      .map(f => f.referenceTo);
    graph.set(type.id, refs);
  }

  function hasCycle(startId) {
    const visited = new Set();
    const stack = new Set();

    function dfs(nodeId) {
      if (stack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      stack.add(nodeId);
      for (const neighbor of (graph.get(nodeId) || [])) {
        if (dfs(neighbor)) return true;
      }
      stack.delete(nodeId);
      return false;
    }

    return dfs(startId);
  }

  for (const type of spec.types) {
    if (hasCycle(type.id)) {
      violations.push(
        `Circular reference detected starting from "${type.id}" (mark bidirectional:true to allow)`
      );
    }
  }

  // Deduplicate cycle violations (same cycle reported from each entry point)
  const uniqueViolations = [...new Set(violations)];

  if (uniqueViolations.length > 0) {
    return {
      pass: false,
      code: 'CTS005',
      message: `${uniqueViolations.length} reference integrity violation(s)`,
      detail: uniqueViolations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'CTS005',
    message: 'All reference fields point to valid types, no circular dependencies',
  };
}
