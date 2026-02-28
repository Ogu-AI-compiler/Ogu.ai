/**
 * Versioned Snapshots — query and restore historical snapshots by version.
 */

export function createVersionedStore() {
  const store = new Map(); // key → array of { version, data, timestamp }

  function save(key, data) {
    if (!store.has(key)) store.set(key, []);
    const versions = store.get(key);
    const version = versions.length + 1;
    versions.push({
      version,
      data: JSON.parse(JSON.stringify(data)),
      timestamp: Date.now(),
    });
    return version;
  }

  function restore(key, version) {
    const versions = store.get(key);
    if (!versions || versions.length === 0) return null;
    if (version === undefined) {
      return JSON.parse(JSON.stringify(versions[versions.length - 1].data));
    }
    const snap = versions.find(v => v.version === version);
    if (!snap) throw new Error(`Version ${version} not found for key ${key}`);
    return JSON.parse(JSON.stringify(snap.data));
  }

  function listVersions(key) {
    const versions = store.get(key);
    if (!versions) return [];
    return versions.map(v => ({
      version: v.version,
      timestamp: v.timestamp,
    }));
  }

  return { save, restore, listVersions };
}
