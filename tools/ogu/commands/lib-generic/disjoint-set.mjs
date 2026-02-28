/**
 * Disjoint Set — manage disjoint sets with merge and query.
 */
export function createDisjointSet() {
  const parent = new Map();
  const rank = new Map();
  let setCount = 0;

  function add(x) {
    if (parent.has(x)) return;
    parent.set(x, x);
    rank.set(x, 0);
    setCount++;
  }

  function find(x) {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
    return parent.get(x);
  }

  function merge(x, y) {
    const rx = find(x), ry = find(y);
    if (rx === ry) return;
    const rankX = rank.get(rx), rankY = rank.get(ry);
    if (rankX < rankY) parent.set(rx, ry);
    else if (rankX > rankY) parent.set(ry, rx);
    else { parent.set(ry, rx); rank.set(rx, rankX + 1); }
    setCount--;
  }

  function sameSet(x, y) { return find(x) === find(y); }
  function getSetCount() { return setCount; }

  return { add, merge, sameSet, getSetCount };
}
