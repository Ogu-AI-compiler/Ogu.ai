/**
 * Leaky Bucket — fixed-rate output bucket.
 */
export function createLeakyBucket({ capacity, leakRate }) {
  let level = 0;
  function add(amount) {
    if (level + amount > capacity) return false;
    level += amount;
    return true;
  }
  function leak() { level = Math.max(0, level - leakRate); }
  function getLevel() { return level; }
  function isEmpty() { return level === 0; }
  return { add, leak, getLevel, isEmpty };
}
