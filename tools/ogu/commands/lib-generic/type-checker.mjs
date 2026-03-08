/**
 * Type Checker — validate values against type schemas.
 */

const PRIMITIVES = new Set(["string", "number", "boolean", "object", "array"]);

export function createTypeChecker() {
  const types = new Map();

  function registerType(name, schema) {
    types.set(name, schema);
  }

  function check(value, typeName) {
    // Primitive types
    if (PRIMITIVES.has(typeName)) {
      return checkPrimitive(value, typeName);
    }

    // Custom types
    const schema = types.get(typeName);
    if (!schema) {
      return { valid: false, error: `Unknown type: ${typeName}` };
    }

    return checkCustom(value, schema);
  }

  function checkPrimitive(value, typeName) {
    if (typeName === "array") {
      return Array.isArray(value)
        ? { valid: true }
        : { valid: false, error: `Expected array, got ${typeof value}` };
    }
    if (typeof value === typeName) {
      return { valid: true };
    }
    return { valid: false, error: `Expected ${typeName}, got ${typeof value}` };
  }

  function checkCustom(value, schema) {
    if (!schema.fields) return { valid: true };
    if (typeof value !== "object" || value === null) {
      return { valid: false, error: "Expected object" };
    }
    for (const [field, fieldType] of Object.entries(schema.fields)) {
      if (!(field in value)) {
        return { valid: false, error: `Missing field: ${field}` };
      }
      const fieldResult = check(value[field], fieldType);
      if (!fieldResult.valid) {
        return { valid: false, error: `Field ${field}: ${fieldResult.error}` };
      }
    }
    return { valid: true };
  }

  return { check, registerType };
}
