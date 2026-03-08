/**
 * Flyweight Factory — share objects with identical intrinsic state.
 */
export function createFlyweightFactory() {
  const cache = new Map();

  function get(key) {
    if (!cache.has(key)) cache.set(key, { key });
    return cache.get(key);
  }

  function getCount() {
    return cache.size;
  }

  return { get, getCount };
}
