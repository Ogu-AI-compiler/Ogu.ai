/**
 * Deque Buffer — double-ended buffer with push/pop from both ends.
 */
export function createDequeBuffer() {
  const data = [];

  function pushFront(value) { data.unshift(value); }
  function pushBack(value) { data.push(value); }
  function popFront() { return data.shift(); }
  function popBack() { return data.pop(); }
  function peekFront() { return data[0]; }
  function peekBack() { return data[data.length - 1]; }
  function size() { return data.length; }
  function isEmpty() { return data.length === 0; }

  return { pushFront, pushBack, popFront, popBack, peekFront, peekBack, size, isEmpty };
}
