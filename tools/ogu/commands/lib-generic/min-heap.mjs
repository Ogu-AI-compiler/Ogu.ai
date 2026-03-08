/**
 * Min Heap — binary min-heap.
 */
export function createMinHeap() {
  const heap = [];
  function parent(i) { return Math.floor((i - 1) / 2); }
  function left(i) { return 2 * i + 1; }
  function right(i) { return 2 * i + 2; }
  function swap(i, j) { [heap[i], heap[j]] = [heap[j], heap[i]]; }

  function push(val) {
    heap.push(val);
    let i = heap.length - 1;
    while (i > 0 && heap[parent(i)] > heap[i]) { swap(i, parent(i)); i = parent(i); }
  }
  function pop() {
    if (heap.length === 0) return null;
    if (heap.length === 1) return heap.pop();
    const min = heap[0];
    heap[0] = heap.pop();
    let i = 0;
    while (true) {
      let smallest = i;
      const l = left(i), r = right(i);
      if (l < heap.length && heap[l] < heap[smallest]) smallest = l;
      if (r < heap.length && heap[r] < heap[smallest]) smallest = r;
      if (smallest === i) break;
      swap(i, smallest); i = smallest;
    }
    return min;
  }
  function peek() { return heap.length > 0 ? heap[0] : null; }
  function size() { return heap.length; }
  return { push, pop, peek, size };
}
