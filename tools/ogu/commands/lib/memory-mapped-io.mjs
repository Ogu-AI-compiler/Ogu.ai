/**
 * Memory Mapped IO — simulated MMIO.
 */
export function createMemoryMappedIO() {
  const regions = [];
  const memory = new Map();
  function mapRegion(base, size, device) { regions.push({ base, size, device }); }
  function write(addr, value) { memory.set(addr, value); }
  function read(addr) { return memory.get(addr) || 0; }
  function getRegions() { return [...regions]; }
  return { mapRegion, write, read, getRegions };
}
