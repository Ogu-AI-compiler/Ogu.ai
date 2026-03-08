/**
 * Hash Table with Separate Chaining.
 */
export function createHashTableChained(buckets = 16) {
  const table = Array.from({ length: buckets }, () => []);
  let count = 0;

  function hash(key) {
    let h = 0;
    const s = String(key);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % buckets;
    return Math.abs(h);
  }

  function put(key, value) {
    const idx = hash(key);
    const bucket = table[idx];
    for (const entry of bucket) {
      if (entry.key === key) { entry.value = value; return; }
    }
    bucket.push({ key, value });
    count++;
  }

  function get(key) {
    const idx = hash(key);
    for (const entry of table[idx]) {
      if (entry.key === key) return entry.value;
    }
    return undefined;
  }

  function delete_(key) {
    const idx = hash(key);
    const bucket = table[idx];
    const i = bucket.findIndex(e => e.key === key);
    if (i !== -1) { bucket.splice(i, 1); count--; }
  }

  function size() { return count; }

  return { put, get, delete: delete_, size };
}
