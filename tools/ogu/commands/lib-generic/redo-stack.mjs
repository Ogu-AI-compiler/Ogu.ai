/**
 * Redo Stack — standalone redo stack for action replay.
 */
export function createRedoStack() {
  const stack = [];
  function push(action) { stack.push(action); }
  function pop() { return stack.pop() || null; }
  function peek() { return stack.length > 0 ? stack[stack.length - 1] : null; }
  function clear() { stack.length = 0; }
  function size() { return stack.length; }
  function isEmpty() { return stack.length === 0; }
  function toArray() { return [...stack]; }
  return { push, pop, peek, clear, size, isEmpty, toArray };
}
