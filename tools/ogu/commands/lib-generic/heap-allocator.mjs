/**
 * Heap Allocator — simulate heap allocation with free.
 */

let nextId = 1;

export function createHeapAllocator({ totalSize }) {
  const blocks = new Map();
  let used = 0;

  function alloc(size) {
    if (used + size > totalSize) return null;
    const id = `blk-${nextId++}`;
    const block = { id, offset: used, size };
    blocks.set(id, block);
    used += size;
    return { ...block };
  }

  function free(id) {
    const block = blocks.get(id);
    if (!block) return;
    used -= block.size;
    blocks.delete(id);
  }

  function getStats() {
    return { totalSize, used, free: totalSize - used, blockCount: blocks.size };
  }

  return { alloc, free, getStats };
}
