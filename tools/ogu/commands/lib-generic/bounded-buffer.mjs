/**
 * Bounded Buffer — fixed-capacity buffer.
 */
export function createBoundedBuffer(capacity) {
  const buffer = [];
  function put(item) { if (buffer.length < capacity) buffer.push(item); }
  function take() { return buffer.shift(); }
  function isFull() { return buffer.length >= capacity; }
  function isEmpty() { return buffer.length === 0; }
  function size() { return buffer.length; }
  return { put, take, isFull, isEmpty, size };
}
