/**
 * Gate: contract-env-schema (ES007)
 * Enforces the env_schema runtime contract: every key must have a description
 * (undescribed keys are opaque to operators), and required keys must not have
 * a default (a required key with a default is effectively optional — the contract
 * is self-contradictory and the validator will behave inconsistently).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'env-schema-spec.json'), 'utf8'));
  const violations = [];

  const noDesc = spec.envKeys.filter(k => !k.description || k.description.trim() === '');
  if (noDesc.length) {
    violations.push({
      rule:  'description-required',
      keys:  noDesc.map(k => k.name),
      reason: 'Each env key must have a description — operators need to understand what the variable does without reading source code',
    });
  }

  const requiredWithDefault = spec.envKeys.filter(k => k.required === true && k.default !== undefined);
  if (requiredWithDefault.length) {
    violations.push({
      rule:  'required-no-default',
      keys:  requiredWithDefault.map(k => k.name),
      reason: 'Required keys must not have a default — the default makes them optional at runtime, contradicting the required: true declaration',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'ES007',
      message: `${violations.length} contract violation(s)`,
      detail: {
        violations,
        hint: 'Add descriptions to all keys. For required keys, remove the default or change required to false.',
      },
    };
  }

  return {
    pass: true, code: 'ES007',
    message: `Env schema contract satisfied — ${spec.envKeys.length} keys, all described`,
  };
}
