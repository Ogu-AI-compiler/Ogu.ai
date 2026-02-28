/**
 * Fenwick Tree (Binary Indexed Tree) — efficient prefix sum queries.
 */
export function createFenwickTree(n) {
  const tree = new Array(n + 1).fill(0);

  function update(i, delta) {
    let idx = i + 1;
    while (idx <= n) {
      tree[idx] += delta;
      idx += idx & (-idx);
    }
  }

  function prefixSum(i) {
    let sum = 0;
    let idx = i + 1;
    while (idx > 0) {
      sum += tree[idx];
      idx -= idx & (-idx);
    }
    return sum;
  }

  function rangeSum(l, r) {
    return prefixSum(r) - (l > 0 ? prefixSum(l - 1) : 0);
  }

  return { update, prefixSum, rangeSum };
}
