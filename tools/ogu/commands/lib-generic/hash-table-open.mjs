/**
 * Hash Table with Open Addressing (linear probing).
 */
export function createHashTableOpen(capacity = 16) {
  const keys = new Array(capacity).fill(undefined);
  const values = new Array(capacity).fill(undefined);
  const deleted = new Array(capacity).fill(false);

  function hash(key) {
    let h = 0;
    const s = String(key);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & (capacity - 1);
    return h;
  }

  function put(key, value) {
    let idx = hash(key);
    for (let i = 0; i < capacity; i++) {
      const probe = (idx + i) % capacity;
      if (keys[probe] === undefined || keys[probe] === key || deleted[probe]) {
        keys[probe] = key;
        values[probe] = value;
        deleted[probe] = false;
        return;
      }
    }
  }

  function get(key) {
    let idx = hash(key);
    for (let i = 0; i < capacity; i++) {
      const probe = (idx + i) % capacity;
      if (keys[probe] === undefined && !deleted[probe]) return undefined;
      if (keys[probe] === key && !deleted[probe]) return values[probe];
    }
    return undefined;
  }

  function delete_(key) {
    let idx = hash(key);
    for (let i = 0; i < capacity; i++) {
      const probe = (idx + i) % capacity;
      if (keys[probe] === undefined && !deleted[probe]) return;
      if (keys[probe] === key) { deleted[probe] = true; return; }
    }
  }

  return { put, get, delete: delete_ };
}
