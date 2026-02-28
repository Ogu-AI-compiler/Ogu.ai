/**
 * Memory Arena — arena-based bulk allocation with instant free.
 */

export function createArena({ capacity }) {
  let pointer = 0;

  function alloc(size) {
    if (pointer + size > capacity) return null;
    const offset = pointer;
    pointer += size;
    return { offset, size };
  }

  function reset() {
    pointer = 0;
  }

  function getStats() {
    return { capacity, used: pointer, remaining: capacity - pointer };
  }

  return { alloc, reset, getStats };
}
