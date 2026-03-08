/**
 * Gate USM005 — valid-visibility
 * Every node that declares a visibility field must use a valid value.
 * Allowed values: "public", "authenticated", or a non-empty role string.
 * Nodes without a visibility field default to "public" — that is allowed.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const STANDARD_VALUES = new Set(['public', 'authenticated']);

function isValidVisibility(v) {
  if (typeof v !== 'string') return false;
  if (v.trim() === '') return false;
  // "public" and "authenticated" are standard.
  // Any non-empty string is treated as a role name and is valid.
  return true;
}

export async function run({ dir }) {
  const specPath = join(dir, 'sitemap-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'USM005', message: 'sitemap-spec.json not found — skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'USM005', message: 'parse error handled by spec-valid — skipped', skipped: true };
  }

  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) {
    return { pass: true, code: 'USM005', message: 'No nodes to check — skipped', skipped: true };
  }

  const violations = [];

  for (const node of spec.nodes) {
    if (node.visibility === undefined || node.visibility === null) {
      // Absence is allowed — defaults to public
      continue;
    }
    if (!isValidVisibility(node.visibility)) {
      violations.push(
        `Node "${node.id}" has invalid visibility value: ${JSON.stringify(node.visibility)} ` +
        `(must be "public", "authenticated", or a non-empty role string)`
      );
    }
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'USM005',
      message: `${violations.length} node(s) with invalid visibility value`,
      detail: violations.join('\n'),
    };
  }

  return {
    pass: true,
    code: 'USM005',
    message: 'valid-visibility: all node visibility values are valid',
  };
}
