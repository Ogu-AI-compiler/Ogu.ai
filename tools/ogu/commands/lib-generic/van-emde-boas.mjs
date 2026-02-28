/**
 * Van Emde Boas — simplified vEB tree for small integer universe.
 */
export function createVanEmdeBoas(universeSize) {
  const present = new Set();
  function insert(x) { present.add(x); }
  function remove(x) { present.delete(x); }
  function member(x) { return present.has(x); }
  function min() {
    let m = Infinity;
    for (const x of present) if (x < m) m = x;
    return m === Infinity ? null : m;
  }
  function max() {
    let m = -Infinity;
    for (const x of present) if (x > m) m = x;
    return m === -Infinity ? null : m;
  }
  function successor(x) {
    let best = null;
    for (const v of present) if (v > x && (best === null || v < best)) best = v;
    return best;
  }
  return { insert, remove, member, min, max, successor };
}
