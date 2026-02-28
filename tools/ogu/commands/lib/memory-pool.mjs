/**
 * Memory Pool — pre-allocated memory pool for efficient allocation.
 */
export function createMemoryPool(blockSize, blockCount) {
  const pool = Array.from({ length: blockCount }, (_, i) => ({ id: i, data: null, free: true }));
  function allocate() {
    const block = pool.find(b => b.free);
    if (!block) return null;
    block.free = false;
    return block.id;
  }
  function release(id) {
    const block = pool[id];
    if (block) { block.free = true; block.data = null; }
  }
  function write(id, data) {
    const block = pool[id];
    if (!block || block.free) throw new Error('Block not allocated');
    block.data = data;
  }
  function read(id) {
    const block = pool[id];
    if (!block || block.free) throw new Error('Block not allocated');
    return block.data;
  }
  function getStats() {
    const used = pool.filter(b => !b.free).length;
    return { total: blockCount, used, free: blockCount - used, blockSize };
  }
  return { allocate, release, write, read, getStats };
}
