/**
 * Webhook Validator — validate incoming webhook payloads.
 */
export function createWebhookValidator() {
  const schemas = new Map();
  function addSchema(event, schema) { schemas.set(event, schema); }
  function validate(event, payload) {
    const schema = schemas.get(event);
    if (!schema) return { valid: true, errors: [] };
    const errors = [];
    for (const field of (schema.required || [])) {
      if (!(field in payload)) errors.push(`Missing required field: ${field}`);
    }
    for (const [field, type] of Object.entries(schema.types || {})) {
      if (field in payload && typeof payload[field] !== type) {
        errors.push(`Field ${field} should be ${type}`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
  function listSchemas() { return [...schemas.keys()]; }
  return { addSchema, validate, listSchemas };
}
