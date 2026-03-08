/**
 * Gate: required-tags-defined (CT002)
 * Validates that every required tag entry declares a key and a description,
 * and checks for common billing tags. Tags without descriptions cannot be
 * communicated to engineering teams. Missing billing tags (team, service,
 * environment) prevent cost attribution in cloud billing dashboards.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const BILLING_TAGS = new Set(['team', 'service', 'environment', 'cost-center', 'project', 'owner']);

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'cost-tagging-spec.json'), 'utf8'));
  const violations = [];

  for (const tag of spec.requiredTags) {
    if (!tag.key)         violations.push({ tag: '(no key)',  field: 'key',         reason: 'Tag entry is missing a key field' });
    if (!tag.description) violations.push({ tag: tag.key,    field: 'description', reason: `Tag "${tag.key}" is missing a description — engineers cannot understand what value to set` });
  }

  const tagKeys = spec.requiredTags.map(t => t.key?.toLowerCase());
  const missingBillingTags = [...BILLING_TAGS].filter(bt => !tagKeys.includes(bt));

  if (missingBillingTags.length && !spec.skipBillingTagCheck) {
    violations.push({
      rule:    'billing-tags-coverage',
      missing: missingBillingTags,
      reason:  `Common billing tags are not defined: ${missingBillingTags.join(', ')}`,
      hint:    'Add these tags to enable cost attribution in cloud billing dashboards. Set skipBillingTagCheck: true for exemption.',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'CT002',
      message: `${violations.length} tag definition issue(s)`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'CT002', message: 'Required tags properly defined' };
}
