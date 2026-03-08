/**
 * Anonymizer — anonymize identifiable data with consistent replacements.
 */
export function createAnonymizer() {
  const map = new Map();
  let counter = 0;
  function anonymize(value) {
    if (map.has(value)) return map.get(value);
    const anon = `ANON_${++counter}`;
    map.set(value, anon);
    return anon;
  }
  function deanonymize(anon) {
    for (const [orig, a] of map) {
      if (a === anon) return orig;
    }
    return null;
  }
  function anonymizeObject(obj, fields) {
    const result = { ...obj };
    for (const f of fields) {
      if (f in result) result[f] = anonymize(result[f]);
    }
    return result;
  }
  function reset() { map.clear(); counter = 0; }
  function getMapping() { return new Map(map); }
  return { anonymize, deanonymize, anonymizeObject, reset, getMapping };
}
