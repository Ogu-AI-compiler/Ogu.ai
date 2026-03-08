/**
 * Release Manager — manage software releases.
 */
export function createReleaseManager() {
  const releases = [];
  function create(version, notes = '', artifacts = []) {
    const release = { version, notes, artifacts, date: Date.now(), status: 'draft' };
    releases.push(release);
    return release;
  }
  function publish(version) {
    const r = releases.find(rel => rel.version === version);
    if (r) r.status = 'published';
    return r;
  }
  function getRelease(version) { return releases.find(r => r.version === version) || null; }
  function list() { return [...releases]; }
  function latest() { return releases.length > 0 ? releases[releases.length - 1] : null; }
  return { create, publish, getRelease, list, latest };
}
