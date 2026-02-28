/**
 * Doubly Linked List — linked list with forward and backward traversal.
 */
export function createDoublyLinkedList() {
  let head = null, tail = null, count = 0;
  function append(value) {
    const node = { value, prev: tail, next: null };
    if (tail) tail.next = node; else head = node;
    tail = node; count++;
  }
  function remove(value) {
    let curr = head;
    while (curr) {
      if (curr.value === value) {
        if (curr.prev) curr.prev.next = curr.next; else head = curr.next;
        if (curr.next) curr.next.prev = curr.prev; else tail = curr.prev;
        count--; return true;
      }
      curr = curr.next;
    }
    return false;
  }
  function toArray() { const arr = []; let curr = head; while (curr) { arr.push(curr.value); curr = curr.next; } return arr; }
  function toArrayReverse() { const arr = []; let curr = tail; while (curr) { arr.push(curr.value); curr = curr.prev; } return arr; }
  function size() { return count; }
  return { append, remove, toArray, toArrayReverse, size };
}
