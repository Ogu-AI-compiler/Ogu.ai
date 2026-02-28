/**
 * Virtual Memory Manager — page-based virtual memory allocation.
 */
export function createVirtualMemoryManager({ pageSize, totalPages }) {
  const pages = new Array(totalPages).fill(false);
  const allocs = new Map();
  function allocate(count) {
    let start = -1, run = 0;
    for (let i = 0; i < totalPages; i++) {
      if (!pages[i]) { if (run === 0) start = i; run++; if (run === count) break; }
      else { run = 0; start = -1; }
    }
    if (run < count) return -1;
    for (let i = start; i < start + count; i++) pages[i] = true;
    const addr = start * pageSize;
    allocs.set(addr, count);
    return addr;
  }
  function free(addr) {
    const count = allocs.get(addr) || 1;
    const page = Math.floor(addr / pageSize);
    for (let i = page; i < page + count && i < totalPages; i++) pages[i] = false;
    allocs.delete(addr);
  }
  function getStats() {
    const usedPages = pages.filter(Boolean).length;
    return { usedPages, freePages: totalPages - usedPages, totalPages, pageSize };
  }
  return { allocate, free, getStats };
}
