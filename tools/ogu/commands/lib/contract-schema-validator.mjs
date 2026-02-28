/**
 * Contract Schema Validator — validate data against contract schemas.
 */

/**
 * Validate data against a contract schema.
 *
 * @param {{ contract: object, data: object }} params
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAgainstContract({ contract, data }) {
  const errors = [];

  // Check required fields
  if (contract.required) {
    for (const field of contract.required) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  // Check field types
  if (contract.fields) {
    for (const [field, spec] of Object.entries(contract.fields)) {
      if (data[field] !== undefined && data[field] !== null) {
        const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
        if (spec.type && actualType !== spec.type) {
          errors.push(`Type mismatch for ${field}: expected ${spec.type}, got ${actualType}`);
        }
      }
    }
  }

  // Check custom invariants
  if (contract.invariants) {
    for (const invariant of contract.invariants) {
      if (typeof invariant === 'function') {
        const err = invariant(data);
        if (err) errors.push(err);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a batch of items against a contract.
 *
 * @param {{ contract: object, items: object[] }} params
 * @returns {{ validCount: number, invalidCount: number, results: object[] }}
 */
export function validateBatch({ contract, items }) {
  let validCount = 0;
  let invalidCount = 0;
  const results = [];

  for (const item of items) {
    const result = validateAgainstContract({ contract, data: item });
    if (result.valid) validCount++;
    else invalidCount++;
    results.push(result);
  }

  return { validCount, invalidCount, results };
}
