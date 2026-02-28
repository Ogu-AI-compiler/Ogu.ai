/**
 * Write Buffer — buffer writes before committing to memory.
 */
export function createWriteBuffer(capacity) {
  const buffer = [];
  function write(addr, value) { buffer.push({ addr, value }); }
  function flush() { const items = [...buffer]; buffer.length = 0; return items; }
  function isFull() { return buffer.length >= capacity; }
  function getSize() { return buffer.length; }
  return { write, flush, isFull, getSize };
}
