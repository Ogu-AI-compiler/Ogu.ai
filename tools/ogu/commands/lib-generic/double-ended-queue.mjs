/**
 * Double-Ended Queue — queue with add/remove from both ends.
 */
export function createDoubleEndedQueue() {
  const data = [];

  function addFirst(value) { data.unshift(value); }
  function addLast(value) { data.push(value); }
  function removeFirst() { return data.shift(); }
  function removeLast() { return data.pop(); }
  function peekFirst() { return data[0]; }
  function peekLast() { return data[data.length - 1]; }
  function size() { return data.length; }
  function toArray() { return [...data]; }

  return { addFirst, addLast, removeFirst, removeLast, peekFirst, peekLast, size, toArray };
}
