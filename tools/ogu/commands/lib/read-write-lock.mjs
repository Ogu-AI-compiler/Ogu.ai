/**
 * Read-Write Lock — multiple readers or single writer.
 */
export function createReadWriteLock() {
  let readers = 0;
  let writing = false;
  function acquireRead() {
    if (writing) return false;
    readers++;
    return true;
  }
  function releaseRead() { if (readers > 0) readers--; }
  function acquireWrite() {
    if (writing || readers > 0) return false;
    writing = true;
    return true;
  }
  function releaseWrite() { writing = false; }
  function getReaders() { return readers; }
  function isWriting() { return writing; }
  return { acquireRead, releaseRead, acquireWrite, releaseWrite, getReaders, isWriting };
}
