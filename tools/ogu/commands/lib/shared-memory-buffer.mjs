/**
 * Shared Memory Buffer — shared memory region for multi-process access.
 */
export function createSharedMemoryBuffer(size) {
  const buffer = new Float64Array(size);
  let locks = new Set();
  function write(offset, value) {
    if (offset < 0 || offset >= size) throw new Error('Out of bounds');
    buffer[offset] = value;
  }
  function read(offset) {
    if (offset < 0 || offset >= size) throw new Error('Out of bounds');
    return buffer[offset];
  }
  function lock(offset) {
    if (locks.has(offset)) return false;
    locks.add(offset);
    return true;
  }
  function unlock(offset) { locks.delete(offset); }
  function isLocked(offset) { return locks.has(offset); }
  function getSize() { return size; }
  return { write, read, lock, unlock, isLocked, getSize };
}
