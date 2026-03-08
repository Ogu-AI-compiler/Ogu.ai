/**
 * Heap Sort — in-place sorting using a max heap.
 */
export function heapSort(arr) {
  const a = [...arr];
  const n = a.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) heapify(a, n, i);
  for (let i = n - 1; i > 0; i--) {
    [a[0], a[i]] = [a[i], a[0]];
    heapify(a, i, 0);
  }
  return a;
}

function heapify(a, n, i) {
  let largest = i;
  const l = 2 * i + 1, r = 2 * i + 2;
  if (l < n && a[l] > a[largest]) largest = l;
  if (r < n && a[r] > a[largest]) largest = r;
  if (largest !== i) { [a[i], a[largest]] = [a[largest], a[i]]; heapify(a, n, largest); }
}
