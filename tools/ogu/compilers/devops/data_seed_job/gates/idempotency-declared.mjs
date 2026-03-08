/**
 * Gate: idempotency-declared (DS003)
 * Validates that the seed job declares an explicit idempotency strategy.
 * Seed jobs must be safe to re-run on failure — without idempotency, a
 * partial failure leaves the database in an inconsistent state, and re-running
 * creates duplicate records or violates unique constraints.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const VALID_CONTRACTS = new Set(['upsert', 'skip-existing', 'truncate-insert', 'merge', 'idempotent-insert']);

export async function run({ dir }) {
  const spec = JSON.parse(readFileSync(join(dir, 'data-seed-spec.json'), 'utf8'));

  // Primary path: named strategy
  if (spec.idempotencyContract) {
    if (!VALID_CONTRACTS.has(spec.idempotencyContract)) {
      return {
        pass: false, code: 'DS003',
        message: `idempotencyContract "${spec.idempotencyContract}" is not a recognised strategy`,
        detail: {
          received: spec.idempotencyContract,
          allowed:  [...VALID_CONTRACTS],
          hint:     'Use a named strategy that describes how re-runs are handled safely',
        },
      };
    }
    return { pass: true, code: 'DS003', message: `Idempotency strategy: ${spec.idempotencyContract}` };
  }

  // Legacy boolean — only accepted when explicitly true AND described
  if (spec.idempotent === true) {
    if (!spec.idempotencyDescription) {
      return {
        pass: false, code: 'DS003',
        message: 'idempotent: true requires an idempotencyDescription explaining the implementation',
        detail: {
          hint:       `Prefer idempotencyContract with a named strategy: ${[...VALID_CONTRACTS].join(', ')}`,
          resolution: 'Add idempotencyDescription: "..." documenting how re-runs are safe',
        },
      };
    }
    return { pass: true, code: 'DS003', message: `Idempotency declared (${spec.idempotencyDescription})` };
  }

  // Explicitly false is a hard rejection — seed jobs must be safe to re-run
  if (spec.idempotent === false) {
    return {
      pass: false, code: 'DS003',
      message: 'idempotent: false — data seed jobs must be idempotent to be safely re-run on failure or re-deployment',
      detail: {
        allowed: [...VALID_CONTRACTS],
        hint:    'Change idempotent to true and add an idempotencyContract, or redesign the seed to use upsert/skip-existing semantics',
      },
    };
  }

  return {
    pass: false, code: 'DS003',
    message: 'Idempotency contract not declared',
    detail: {
      allowed: [...VALID_CONTRACTS],
      hint:    'Add idempotencyContract with one of the listed strategies to make this gate pass',
    },
  };
}
