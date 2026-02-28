/**
 * Binary Heap — generic binary heap with comparator.
 */
export function createBinaryHeap(comparator) {
  const heap = [];
  function parent(i) { return Math.floor((i - 1) / 2); }
  function left(i) { return 2 * i + 1; }
  function right(i) { return 2 * i + 2; }
  function swap(i, j) { [heap[i], heap[j]] = [heap[j], heap[i]]; }
  function siftUp(i) {
    while (i > 0 && comparator(heap[i], heap[parent(i)]) < 0) { swap(i, parent(i)); i = parent(i); }
  }
  function siftDown(i) {
    const n = heap.length;
    while (true) {
      let smallest = i;
      const l = left(i), r = right(i);
      if (l < n && comparator(heap[l], heap[smallest]) < 0) smallest = l;
      if (r < n && comparator(heap[r], heap[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      swap(i, smallest); i = smallest;
    }
  }
  function insert(val) { heap.push(val); siftUp(heap.length - 1); }
  function extract() { const top = heap[0]; heap[0] = heap[heap.length-1]; heap.pop(); siftDown(0); return top; }
  function peek() { return heap[0]; }
  function size() { return heap.length; }
  return { insert, extract, peek, size };
}
