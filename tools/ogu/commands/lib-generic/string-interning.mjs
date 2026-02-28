/**
 * String Interning — deduplicate strings by returning canonical references.
 */
export function createStringInterner() {
  const pool = new Map();
  let nextId = 1;

  function intern(str) {
    if (!pool.has(str)) pool.set(str, nextId++);
    return pool.get(str);
  }

  function getCount() {
    return pool.size;
  }

  function has(str) {
    return pool.has(str);
  }

  return { intern, getCount, has };
}
