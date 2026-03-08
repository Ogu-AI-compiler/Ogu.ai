/**
 * Semver Parser — parse and manipulate semantic version strings.
 */
export function parse(version) {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] || null };
}

export function stringify(semver) {
  let s = `${semver.major}.${semver.minor}.${semver.patch}`;
  if (semver.prerelease) s += `-${semver.prerelease}`;
  return s;
}

export function bump(version, type) {
  const v = typeof version === 'string' ? parse(version) : { ...version };
  if (!v) return null;
  if (type === 'major') { v.major++; v.minor = 0; v.patch = 0; }
  else if (type === 'minor') { v.minor++; v.patch = 0; }
  else if (type === 'patch') { v.patch++; }
  v.prerelease = null;
  return v;
}

export function isValid(version) { return parse(version) !== null; }
