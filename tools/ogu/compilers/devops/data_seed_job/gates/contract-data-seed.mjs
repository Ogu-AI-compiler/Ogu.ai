/**
 * Gate: contract-data-seed (DS007)
 * Validates that data-seed-spec.json satisfies the data seed contract:
 * every seed job must declare idempotency (so it can be re-run safely) and
 * an owner (for accountability when the seed fails or corrupts data).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export async function run({ dir }) {
  const spec       = JSON.parse(readFileSync(join(dir, 'data-seed-spec.json'), 'utf8'));
  const violations = [];

  if (!spec.idempotencyContract && !spec.idempotent) {
    violations.push({
      rule:   'idempotency-required',
      reason: 'No idempotency contract declared — the seed job cannot be safely re-run if it fails partway through',
      hint:   'Add idempotent: true and document the idempotency strategy (e.g., upsert, skip-if-exists)',
    });
  }
  if (!spec.owner) {
    violations.push({
      rule:   'owner-required',
      reason: 'No owner declared — accountability for data changes cannot be established',
      hint:   'Add owner: "team-name" or an email address',
    });
  }

  if (violations.length) {
    return {
      pass: false, code: 'DS007',
      message: `${violations.length} contract violation(s) in data-seed-spec.json`,
      detail: { violations },
    };
  }

  return { pass: true, code: 'DS007', message: `Data seed contract satisfied — "${spec.name}"` };
}
