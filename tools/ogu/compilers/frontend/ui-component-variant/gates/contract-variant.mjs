import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/** UCV008 — contract-variant: validates spec against component-variant.contract.json */

const __dir = dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = join(__dir, '..', 'contracts', 'component-variant.contract.json');

export async function run({ dir }) {
  const specPath = join(dir, 'component-variant-spec.json');
  if (!existsSync(specPath)) {
    return { pass: true, code: 'UCV008', message: 'No spec file — gate skipped', skipped: true };
  }

  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch {
    return { pass: true, code: 'UCV008', message: 'Invalid JSON — gate skipped', skipped: true };
  }

  let contract;
  try {
    contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  } catch (err) {
    return { pass: false, code: 'UCV008', message: `Cannot load contract: ${err.message}` };
  }

  const variants = Array.isArray(spec.variants) ? spec.variants : [];
  const violations = [];

  // Rule: has-default-variant — at least one variant should be the default
  const hasDefault = variants.some(v =>
    String(v.id || '').toLowerCase() === 'default'
    || v.isDefault === true
    || (v.props && v.props.intent === 'default')
    || (v.props && v.props.variant === 'default')
  );
  if (!hasDefault) {
    violations.push('Rule "has-default-variant": no default variant declared — components need a baseline visual');
  }

  // Rule: variant-ids-unique — no two variants share the same id
  const seen = new Map();
  for (const v of variants) {
    if (v.id) {
      if (seen.has(v.id)) {
        violations.push(`Rule "variant-ids-unique": duplicate variant id "${v.id}"`);
      } else {
        seen.set(v.id, true);
      }
    }
  }

  // Rule: component-name-set — component field must be a non-empty string
  if (!spec.component || typeof spec.component !== 'string' || !spec.component.trim()) {
    violations.push('Rule "component-name-set": component field must be a non-empty string');
  }

  // Rule: minimum-two-variants — at least primary and secondary (or similar) should exist
  if (variants.length < 2) {
    violations.push(`Rule "minimum-two-variants": only ${variants.length} variant(s) — minimum 2 required for a useful component`);
  }

  if (violations.length > 0) {
    return {
      pass: false,
      code: 'UCV008',
      message: `${violations.length} contract rule(s) violated`,
      detail: violations.slice(0, 10).join('\n'),
    };
  }

  return { pass: true, code: 'UCV008', message: `Contract "${contract.id}" satisfied (${variants.length} variants)` };
}
