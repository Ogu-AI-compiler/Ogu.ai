/**
 * Schema Validator — validate objects against JSON-like schemas.
 */
export function createSchemaValidator(schema) {
  function validate(data) {
    const errors = [];
    if (schema.type === 'object' && typeof data === 'object' && data !== null) {
      if (schema.required) {
        for (const key of schema.required) {
          if (!(key in data)) errors.push({ path: `/${key}`, message: `required field missing` });
        }
      }
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in data && typeof data[key] !== propSchema.type) {
            errors.push({ path: `/${key}`, message: `expected ${propSchema.type}, got ${typeof data[key]}` });
          }
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }
  return { validate };
}
