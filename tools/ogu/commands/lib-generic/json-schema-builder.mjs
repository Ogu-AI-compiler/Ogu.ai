/**
 * JSON Schema Builder — fluent API for building JSON schemas.
 */
export function createJsonSchemaBuilder(type = 'object') {
  const schema = { type, properties: {}, required: [] };
  function prop(name, propSchema) { schema.properties[name] = propSchema; return api; }
  function required(name) { schema.required.push(name); return api; }
  function string(name, opts = {}) { return prop(name, { type: 'string', ...opts }); }
  function number(name, opts = {}) { return prop(name, { type: 'number', ...opts }); }
  function boolean(name) { return prop(name, { type: 'boolean' }); }
  function array(name, items = {}) { return prop(name, { type: 'array', items }); }
  function build() { return JSON.parse(JSON.stringify(schema)); }
  const api = { prop, required, string, number, boolean, array, build };
  return api;
}
