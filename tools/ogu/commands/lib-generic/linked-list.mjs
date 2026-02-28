/**
 * Linked List — singly linked list.
 */
export function createLinkedList() {
  let head = null, count = 0;
  function append(value) {
    const node = { value, next: null };
    if (!head) { head = node; } else { let curr = head; while (curr.next) curr = curr.next; curr.next = node; }
    count++;
  }
  function prepend(value) { head = { value, next: head }; count++; }
  function toArray() { const arr = []; let curr = head; while (curr) { arr.push(curr.value); curr = curr.next; } return arr; }
  function size() { return count; }
  return { append, prepend, toArray, size };
}
