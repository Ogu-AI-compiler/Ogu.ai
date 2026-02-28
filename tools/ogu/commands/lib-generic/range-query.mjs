/**
 * Range Query — prefix-sum based range queries for sum, min, max.
 */
export function createRangeQuery(arr) {
  const prefix = [0];
  for (let i = 0; i < arr.length; i++) prefix.push(prefix[i] + arr[i]);
  function sum(l, r) { return prefix[r + 1] - prefix[l]; }
  function min(l, r) {
    let m = arr[l];
    for (let i = l + 1; i <= r; i++) if (arr[i] < m) m = arr[i];
    return m;
  }
  function max(l, r) {
    let m = arr[l];
    for (let i = l + 1; i <= r; i++) if (arr[i] > m) m = arr[i];
    return m;
  }
  return { sum, min, max };
}
