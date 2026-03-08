/**
 * Gate: values-yaml-valid (HC003)
 * Validates that values.yaml exists and is non-empty. An absent or empty
 * values.yaml means templates referencing .Values.* will all fail to render,
 * and helm install will succeed only if no values are actually referenced.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const valuesPath = join(dir, 'values.yaml');

  if (!existsSync(valuesPath)) {
    return {
      pass: false, code: 'HC003',
      message: 'values.yaml not found',
      detail: { searched: valuesPath, hint: 'Create values.yaml with default values for all .Values.* references in your templates' },
    };
  }

  const content = readFileSync(valuesPath, 'utf8');
  if (content.trim().length === 0) {
    return {
      pass: false, code: 'HC003',
      message: 'values.yaml is empty',
      detail: { hint: 'Populate values.yaml with default values — even a minimal set. Templates that reference .Values.* will fail at render time with no defaults.' },
    };
  }

  return { pass: true, code: 'HC003', message: 'values.yaml exists and is non-empty' };
}
