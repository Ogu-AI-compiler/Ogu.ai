/**
 * Segment Tree — range sum query with point updates.
 */
export function createSegmentTree(arr) {
  const n = arr.length;
  const tree = new Array(4 * n).fill(0);

  function build(node, start, end) {
    if (start === end) { tree[node] = arr[start]; return; }
    const mid = (start + end) >> 1;
    build(2 * node, start, mid);
    build(2 * node + 1, mid + 1, end);
    tree[node] = tree[2 * node] + tree[2 * node + 1];
  }

  function queryRange(node, start, end, l, r) {
    if (r < start || end < l) return 0;
    if (l <= start && end <= r) return tree[node];
    const mid = (start + end) >> 1;
    return queryRange(2 * node, start, mid, l, r) +
           queryRange(2 * node + 1, mid + 1, end, l, r);
  }

  function updatePoint(node, start, end, idx, val) {
    if (start === end) { tree[node] = val; arr[idx] = val; return; }
    const mid = (start + end) >> 1;
    if (idx <= mid) updatePoint(2 * node, start, mid, idx, val);
    else updatePoint(2 * node + 1, mid + 1, end, idx, val);
    tree[node] = tree[2 * node] + tree[2 * node + 1];
  }

  build(1, 0, n - 1);

  function query(l, r) { return queryRange(1, 0, n - 1, l, r); }
  function update(idx, val) { updatePoint(1, 0, n - 1, idx, val); }

  return { query, update };
}
