/**
 * Type Coercer — coerce values between types.
 */
export function coerce(value, targetType) {
  switch (targetType) {
    case 'string': return String(value);
    case 'number': return Number(value);
    case 'boolean':
      if (typeof value === 'string') return value === 'true';
      return Boolean(value);
    case 'array': return Array.isArray(value) ? value : [value];
    default: return value;
  }
}
