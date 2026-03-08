/**
 * Accept Resolver — resolve content type from Accept header.
 */
export function createAcceptResolver(supported = []) {
  function resolve(acceptHeader) {
    const types = acceptHeader.split(',').map(t => {
      const [type, ...params] = t.trim().split(';');
      let q = 1;
      for (const p of params) { const m = p.trim().match(/q=(.+)/); if (m) q = parseFloat(m[1]); }
      return { type: type.trim(), q };
    }).sort((a, b) => b.q - a.q);
    for (const t of types) {
      if (t.type === '*/*') return supported[0] || null;
      const found = supported.find(s => s === t.type);
      if (found) return found;
    }
    return null;
  }
  function addSupported(type) { supported.push(type); }
  function listSupported() { return [...supported]; }
  return { resolve, addSupported, listSupported };
}
