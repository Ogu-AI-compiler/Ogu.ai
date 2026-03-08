/**
 * Config Schema Validator — validate JSON configs against declarative schemas.
 *
 * Lightweight JSON schema validation for Ogu config files.
 */

/**
 * Built-in schemas for Ogu config files.
 */
export const OGU_SCHEMAS = {
  STATE: {
    type: 'object',
    required: [],
    properties: {
      current_task: { type: 'string' },
      involvement_level: { type: 'string' },
      phase: { type: 'string' },
    },
  },
  ORGSPEC: {
    type: 'object',
    required: ['company', 'roles', 'providers'],
    properties: {
      company: { type: 'string' },
      roles: { type: 'array' },
      providers: { type: 'array' },
      budget: { type: 'object' },
    },
  },
};

/**
 * Validate a config object against a schema.
 *
 * @param {object} config - The config to validate
 * @param {object} schema - Schema with type, required, properties
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConfig(config, schema) {
  const errors = [];

  if (schema.type === 'object' && (typeof config !== 'object' || config === null || Array.isArray(config))) {
    errors.push('Expected object');
    return { valid: false, errors };
  }

  // Check required fields
  for (const field of (schema.required || [])) {
    if (config[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Check property types
  for (const [key, propSchema] of Object.entries(schema.properties || {})) {
    if (config[key] === undefined) continue;
    const actual = config[key];
    const expectedType = propSchema.type;

    if (!checkType(actual, expectedType)) {
      errors.push(`Field "${key}" expected ${expectedType}, got ${typeof actual}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function checkType(value, expectedType) {
  switch (expectedType) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number';
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
    default: return true;
  }
}
