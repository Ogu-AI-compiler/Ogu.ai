/**
 * Barrier Synchronizer — multi-party synchronization primitive.
 */

/**
 * @param {number} parties - number of parties required
 */
export function createBarrier(parties) {
  const arrived = new Set();

  function arrive(partyId) {
    arrived.add(partyId);
  }

  function isComplete() {
    return arrived.size >= parties;
  }

  function getArrived() {
    return arrived.size;
  }

  function reset() {
    arrived.clear();
  }

  return { arrive, isComplete, getArrived, reset };
}
