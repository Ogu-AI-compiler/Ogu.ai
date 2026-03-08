/**
 * Gate: tag-values-valid (CT003)
 * Validates that tag keys follow cloud provider naming constraints and that
 * allowed values and default values are consistent. Invalid tag keys are
 * silently truncated or rejected by AWS/GCP/Azure, making the tag policy
 * appear to apply while having no actual effect.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const TAG_KEY_RE   = /^[a-zA-Z0-9_\-:/.]{1,128}$/;
const TAG_VALUE_RE = /^[a-zA-Z0-9_\-:/.@]{0,256}$/;

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'cost-tagging-spec.json'), 'utf8'));
  const violations = [];

  for (const tag of spec.requiredTags) {
    if (tag.key && !TAG_KEY_RE.test(tag.key)) {
      violations.push({ tag: tag.key, field: 'key', reason: 'Tag key contains invalid characters or exceeds 128 chars — cloud providers will reject or truncate it', hint: 'Use only alphanumeric characters, hyphens, underscores, colons, periods, and forward slashes' });
    }
    if (tag.allowedValues) {
      for (const v of tag.allowedValues) {
        if (!TAG_VALUE_RE.test(String(v))) {
          violations.push({ tag: tag.key, field: 'allowedValues', value: v, reason: `Value "${v}" contains invalid characters` });
        }
      }
    }
    if (tag.defaultValue && tag.allowedValues && !tag.allowedValues.includes(tag.defaultValue)) {
      violations.push({ tag: tag.key, field: 'defaultValue', defaultValue: tag.defaultValue, allowedValues: tag.allowedValues, reason: `defaultValue "${tag.defaultValue}" is not in allowedValues` });
    }
  }

  if (violations.length) {
    return {
      pass: false, code: 'CT003',
      message: `${violations.length} tag value issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'CT003', message: 'Tag keys and values valid' };
}
