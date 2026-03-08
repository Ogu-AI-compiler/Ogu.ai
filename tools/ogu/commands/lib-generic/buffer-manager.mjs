/**
 * Buffer Manager — allocate and manage fixed-size buffer pool.
 */
export function createBufferManager({ poolSize }) {
  const buffers = new Map();
  let nextId = 1;
  let allocated = 0;

  function allocate(size) {
    if (allocated >= poolSize) return null;
    const id = nextId++;
    buffers.set(id, Buffer.alloc(size));
    allocated++;
    return id;
  }

  function get(id) {
    return buffers.get(id) || null;
  }

  function release(id) {
    if (buffers.has(id)) {
      buffers.delete(id);
      allocated--;
    }
  }

  function getStats() {
    return { allocated, poolSize, available: poolSize - allocated };
  }

  return { allocate, get, release, getStats };
}
