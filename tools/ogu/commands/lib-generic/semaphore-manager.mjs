/**
 * Semaphore Manager — resource permits with acquire/release.
 */

/**
 * @param {number} maxPermits
 */
export function createSemaphore(maxPermits) {
  let permits = maxPermits;

  function acquire() {
    if (permits <= 0) return false;
    permits--;
    return true;
  }

  function release() {
    if (permits < maxPermits) permits++;
  }

  function available() {
    return permits;
  }

  return { acquire, release, available };
}
