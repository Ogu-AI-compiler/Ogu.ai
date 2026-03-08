/**
 * Union-Find — disjoint set with path compression and union by rank.
 */
export function createUnionFind() {
  const parent = new Map();
  const rank = new Map();

  function makeSet(x) {
    parent.set(x, x);
    rank.set(x, 0);
  }

  function find(x) {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
    return parent.get(x);
  }

  function union(x, y) {
    const rx = find(x), ry = find(y);
    if (rx === ry) return;
    const rankX = rank.get(rx), rankY = rank.get(ry);
    if (rankX < rankY) parent.set(rx, ry);
    else if (rankX > rankY) parent.set(ry, rx);
    else { parent.set(ry, rx); rank.set(rx, rankX + 1); }
  }

  function connected(x, y) {
    return find(x) === find(y);
  }

  return { makeSet, find, union, connected };
}
