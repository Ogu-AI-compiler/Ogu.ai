/**
 * Hash Chain — build a chain of hashes for integrity verification.
 */
export function createHashChain() {
  const chain = [];
  function _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h).toString(16).padStart(8, '0');
  }
  function append(data) {
    const prev = chain.length > 0 ? chain[chain.length - 1].hash : '00000000';
    const hash = _hash(prev + JSON.stringify(data));
    chain.push({ data, hash, prev });
    return hash;
  }
  function verify() {
    for (let i = 0; i < chain.length; i++) {
      const prev = i > 0 ? chain[i - 1].hash : '00000000';
      const expected = _hash(prev + JSON.stringify(chain[i].data));
      if (chain[i].hash !== expected) return false;
      if (chain[i].prev !== prev) return false;
    }
    return true;
  }
  function getChain() { return chain.map(c => ({ ...c })); }
  function length() { return chain.length; }
  return { append, verify, getChain, length };
}
