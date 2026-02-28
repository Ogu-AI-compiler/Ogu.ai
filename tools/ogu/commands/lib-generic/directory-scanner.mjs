/**
 * Directory Scanner — scan directory structures (simulated).
 */
export function createDirectoryScanner() {
  const entries = new Map();
  function addEntry(path, type = 'file', size = 0) {
    entries.set(path, { path, type, size });
  }
  function scan(prefix = '') {
    return [...entries.values()].filter(e => e.path.startsWith(prefix));
  }
  function files(prefix = '') { return scan(prefix).filter(e => e.type === 'file'); }
  function dirs(prefix = '') { return scan(prefix).filter(e => e.type === 'dir'); }
  function totalSize(prefix = '') { return scan(prefix).reduce((sum, e) => sum + e.size, 0); }
  function count() { return entries.size; }
  return { addEntry, scan, files, dirs, totalSize, count };
}
