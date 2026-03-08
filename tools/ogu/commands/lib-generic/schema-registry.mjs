/**
 * Schema Registry — register and retrieve schemas by name and version.
 */
export function createSchemaRegistry() {
  const schemas = new Map();
  function register(name, version, schema) {
    const key = `${name}@${version}`;
    schemas.set(key, { name, version, schema, registeredAt: Date.now() });
  }
  function get(name, version) { return schemas.get(`${name}@${version}`)?.schema || null; }
  function getLatest(name) {
    let latest = null;
    for (const [, entry] of schemas) {
      if (entry.name === name && (!latest || entry.version > latest.version)) latest = entry;
    }
    return latest?.schema || null;
  }
  function list() { return [...schemas.values()].map(s => ({ name: s.name, version: s.version })); }
  function has(name, version) { return schemas.has(`${name}@${version}`); }
  return { register, get, getLatest, list, has };
}
