/**
 * File Deduplicator — detect and manage duplicate files by content hash.
 */
export function createFileDeduplicator(hashFn) {
  const hashes = new Map();
  function add(path, content) {
    const hash = hashFn(content);
    if (!hashes.has(hash)) hashes.set(hash, []);
    hashes.get(hash).push(path);
  }
  function getDuplicates() {
    const dupes = [];
    for (const [hash, paths] of hashes) {
      if (paths.length > 1) dupes.push({ hash, paths: [...paths] });
    }
    return dupes;
  }
  function hasDuplicate(content) {
    const hash = hashFn(content);
    return (hashes.get(hash) || []).length > 1;
  }
  function totalFiles() { let c = 0; for (const p of hashes.values()) c += p.length; return c; }
  function uniqueCount() { return hashes.size; }
  return { add, getDuplicates, hasDuplicate, totalFiles, uniqueCount };
}
