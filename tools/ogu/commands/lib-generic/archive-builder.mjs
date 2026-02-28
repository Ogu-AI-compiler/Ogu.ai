/**
 * Archive Builder — build archive from files (in-memory).
 */
export function createArchiveBuilder(name) {
  const files = new Map();
  const metadata = { name, created: Date.now() };
  function addFile(path, content) { files.set(path, content); }
  function removeFile(path) { files.delete(path); }
  function build() {
    return { metadata: { ...metadata, fileCount: files.size }, files: Object.fromEntries(files) };
  }
  function listFiles() { return [...files.keys()]; }
  function getSize() { return [...files.values()].reduce((s, c) => s + String(c).length, 0); }
  return { addFile, removeFile, build, listFiles, getSize };
}
