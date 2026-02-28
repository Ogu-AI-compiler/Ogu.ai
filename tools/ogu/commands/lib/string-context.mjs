/**
 * String Context — key-value context for template resolution.
 */
export function createStringContext() {
  const vars = new Map();
  function set(key, value) { vars.set(key, value); }
  function get(key) { return vars.get(key); }
  function resolve(template) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return vars.has(key) ? String(vars.get(key)) : match;
    });
  }
  function keys() { return [...vars.keys()]; }
  return { set, get, resolve, keys };
}
