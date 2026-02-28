/**
 * Spin Lock — simple boolean lock.
 */
export function createSpinLock() {
  let locked = false;
  function tryLock() {
    if (locked) return false;
    locked = true;
    return true;
  }
  function unlock() { locked = false; }
  function isLocked() { return locked; }
  return { tryLock, unlock, isLocked };
}
