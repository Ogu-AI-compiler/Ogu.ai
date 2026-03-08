/**
 * Gate USM002 — unique-ids
 * Every node in sitemap-spec.json must have a unique id.
 * Duplicate IDs cause cross-reference failures in all downstream compilers.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const specPath = join(dir, 'sitemap-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USM002', message: 'sitemap-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USM002', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'USM002', message: 'No nodes to check — skipped', skipped: true };
  }

  const seen = new Map();
  const duplicates = [];

  for (const node of spec.nodes) {
    if (typeof node.id !== 'string') continue;
    if (seen.has(node.id)) {
      duplicates.push(`Duplicate node id: "${node.id}"`);
    } else {
      seen.set(node.id, true);
    }
  }

  if (duplicates.length > 0) {
    return {
      pass: false,
      code: 'USM002',
      message: `${duplicates.length} duplicate node id(s) found`,
      detail: duplicates.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USM002',
    message: `unique-ids: all ${spec.nodes.length} node ids are unique`,
  };
}
