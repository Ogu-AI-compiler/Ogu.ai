/**
 * Input Validator — validate and sanitize user/agent inputs.
 */

export const VALIDATION_TYPES = ['string', 'number', 'boolean', 'object', 'array'];

/**
 * Validate input against a schema.
 *
 * @param {object} input
 * @param {{ fields: Object<string, { required?: boolean, type?: string }> }} schema
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateInput(input, schema) {
  const errors = [];

  for (const [name, spec] of Object.entries(schema.fields || {})) {
    const value = input[name];

    if (spec.required && (value === undefined || value === null)) {
      errors.push(`Missing required field: ${name}`);
      continue;
    }

    if (value !== undefined && value !== null && spec.type) {
      const actual = Array.isArray(value) ? 'array' : typeof value;
      if (actual !== spec.type) {
        errors.push(`Field "${name}" expected ${spec.type}, got ${actual}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize input by stripping unknown fields.
 *
 * @param {object} input
 * @param {{ fields: Object }} schema
 * @returns {object}
 */
export function sanitizeInput(input, schema) {
  const result = {};
  for (const key of Object.keys(schema.fields || {})) {
    if (key in input) {
      result[key] = input[key];
    }
  }
  return result;
}
