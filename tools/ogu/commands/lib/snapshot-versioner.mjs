/**
 * Snapshot Versioner — version snapshots with diffs and changeset chains.
 */

export function createSnapshotVersioner() {
  const snapshots = []; // array of { version, data, timestamp }

  function commit(data) {
    const version = snapshots.length + 1;
    snapshots.push({
      version,
      data: JSON.parse(JSON.stringify(data)),
      timestamp: Date.now(),
    });
    return version;
  }

  function getVersion(version) {
    const snap = snapshots.find(s => s.version === version);
    if (!snap) throw new Error(`Version ${version} not found`);
    return JSON.parse(JSON.stringify(snap.data));
  }

  function getDiff(fromVersion, toVersion) {
    const from = getVersion(fromVersion);
    const to = getVersion(toVersion);
    const diffs = [];
    const allKeys = new Set([...Object.keys(from), ...Object.keys(to)]);
    for (const key of allKeys) {
      const inFrom = key in from;
      const inTo = key in to;
      if (!inFrom && inTo) diffs.push({ type: "added", key, value: to[key] });
      else if (inFrom && !inTo) diffs.push({ type: "removed", key, value: from[key] });
      else if (JSON.stringify(from[key]) !== JSON.stringify(to[key]))
        diffs.push({ type: "changed", key, before: from[key], after: to[key] });
    }
    return diffs;
  }

  function getHistory() {
    return snapshots.map(s => ({
      version: s.version,
      timestamp: s.timestamp,
    }));
  }

  return { commit, getVersion, getDiff, getHistory };
}
