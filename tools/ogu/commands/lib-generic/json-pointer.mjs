/**
 * JSON Pointer — RFC 6901 JSON Pointer get/set.
 */
export function get(obj, pointer) {
  if (pointer === '' || pointer === '/') return obj;
  const parts = pointer.split('/').filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

export function set(obj, pointer, value) {
  const parts = pointer.split('/').filter(Boolean);
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}
