/**
 * Protocol Version Manager — manage protocol version compatibility.
 */

export function createVersionManager() {
  const versions = [];

  function register({ version, minCompatible }) {
    versions.push({ version, minCompatible });
  }

  function isCompatible(version, peerVersion) {
    const entry = versions.find(v => v.version === version);
    if (!entry) return false;
    return compareVersions(peerVersion, entry.minCompatible) >= 0;
  }

  function getLatest() {
    if (versions.length === 0) return null;
    return versions.sort((a, b) => compareVersions(b.version, a.version))[0].version;
  }

  function listVersions() {
    return versions.map(v => ({ ...v }));
  }

  return { register, isCompatible, getLatest, listVersions };
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}
